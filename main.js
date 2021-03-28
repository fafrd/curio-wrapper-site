import { ethers } from "ethers";
import 'regenerator-runtime/runtime'
import * as constants from "./constants.js"
//import * as constants from "./rinkeby-constants.js"

import images_jpg from "./images/*.jpg"
import images_png from "./images/*.png"
import images_gif from "./images/*.gif"
let images = Object.assign({}, images_jpg, images_png, images_gif);

const numCards = 30; // for debugging

const { ethereum } = window;
if (ethereum) {
    var provider = new ethers.providers.Web3Provider(ethereum);
    var signer = provider.getSigner();
}

function isEthereumAvailable() {
    Boolean(ethereum);
}

function updateStatusBar(color, blink, contents) {
    // remove existing state
    document.getElementById("connection-indicator").classList.remove("circle-blink");
    document.getElementById("connection-indicator").classList.remove("circle-red");
    document.getElementById("connection-indicator").classList.remove("circle-orange");
    document.getElementById("connection-indicator").classList.remove("circle-green");

    // set blink
    if (blink) {
        document.getElementById("connection-indicator").classList.add("circle-blink");
    }

    // add color
    document.getElementById("connection-indicator").classList.add("circle-" + color);

    // set contents
    document.getElementById("web3").innerText = contents;
}

async function resetStatusBarToGreen() {
    getUserAddr().then(userAddr => {
        updateStatusBar("green", false, "Connected as " + userAddr.substring(0, 5) + "…" + userAddr.substring(userAddr.length-3));
    });
}

async function connectWallet() {
    console.debug("connectWallet");
    await ethereum.request({
        method: 'eth_requestAccounts'
    });
    const accts = await provider.listAccounts();
    if (accts.length > 0) {
        document.getElementById("connect-wallet").remove();
    } else {
        throw Error("Connected to ethereum but provider.listAccounts() returned empty!");
    }

    // once connected, perform the next tasks, like populating token balances
    postConnection();
    // show "click the cards" helper image
    document.getElementById("click-da-cards").classList.remove("hidden");
}

async function getUserAddr() {
    return await provider.listAccounts().then(accts => {
        if (accts.length > 0) {
            console.debug("connected! " + JSON.stringify(accts));
            return accts[0];
        } else {
            console.debug("not yet connected!");
            return;
        }
    });
}

async function getErc20Balance(tokenAddr, userAddr) {
    //console.debug("fetching balance for tokenAddr: " + tokenAddr);
    //await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

    const contract = await new ethers.Contract(tokenAddr, constants.erc20Abi, provider);
    return await contract.balanceOf(userAddr);
}

async function getErc1155BalanceBatch(contractAddr, userAddr) {
    const contract = await new ethers.Contract(contractAddr, constants.wrapperAbi, provider);
    console.debug("querying batch... ");
    const userAddrArray = Array(30).fill(userAddr);
    let idArray = Array.from(Array(31).keys());
    idArray.shift();

    return await contract.balanceOfBatch(userAddrArray, idArray);
}

async function handleCardClick(event) {
    let currentElement, otherElement; // otherElement is erc1155 if current is erc20, etc
    currentElement = event.path.find(e => e.localName == "article");
    if (!currentElement) {
        throw Error("handleCardClick: unable to find <article> element!");
    }

    return await _handleCardClick(currentElement, otherElement);
}

async function _handleCardClick(currentElement, otherElement) {
    let currentCard, currentType;

    if (document.getElementById("click-da-cards")) {
        // remove "click the cards" helper image
        document.getElementById("click-da-cards").remove();
        // show middle dividing line
        document.getElementById("middle-line").classList.remove("hidden");
    }

    if (currentElement.id.startsWith("nav-card-erc20")) {
        currentCard = Number(currentElement.id.substring(15));
        currentType = "erc20";
        otherElement = document.getElementById("nav-card-erc1155-" + currentCard);
    } else if (currentElement.id.startsWith("nav-card-erc1155")) {
        currentCard = Number(currentElement.id.substring(17));
        currentType = "erc1155";
        otherElement = document.getElementById("nav-card-erc20-" + currentCard);
    }

    if (currentElement.classList.contains("unselected")) {
        // card is unselected- set to selected
        currentElement.classList.remove("unselected");
        currentElement.classList.add("selected");
        otherElement.classList.remove("unselected");
        otherElement.classList.add("selected");

        // unhide table row
        document.getElementById("row-" + currentCard).classList.remove("hidden");
        document.getElementById("row-" + currentCard).classList.add("row-displayinitial");

        //set currentElement and otherElement to have the selected class
        Array.from(currentElement.children).find(e => e.localName == "img").classList.add("nav-card__grayscale");
        Array.from(otherElement.children).find(e => e.localName == "img").classList.add("nav-card__grayscale");

        Array.from(currentElement.children).find(e => e.classList.contains("nav-card__overlay")).classList.add("nav-card__overlay-selected");
        Array.from(otherElement.children).find(e => e.classList.contains("nav-card__overlay")).classList.add("nav-card__overlay-selected");

    } else if (currentElement.classList.contains("selected")) {
        // card is selected- set to unselected
        currentElement.classList.remove("selected");
        currentElement.classList.add("unselected");
        otherElement.classList.remove("selected");
        otherElement.classList.add("unselected");

        // hide table row
        document.getElementById("row-" + currentCard).classList.remove("row-displayinitial");
        document.getElementById("row-" + currentCard).classList.add("hidden");

        // set to-wrap-# for this row back to 0
        document.getElementById("to-wrap-" + currentCard).value = "";
        document.getElementById("to-unwrap-" + currentCard).value = "";

        Array.from(currentElement.children).find(e => e.localName == "img").classList.remove("nav-card__grayscale");
        Array.from(otherElement.children).find(e => e.localName == "img").classList.remove("nav-card__grayscale");

        Array.from(currentElement.children).find(e => e.classList.contains("nav-card__overlay")).classList.remove("nav-card__overlay-selected");
        Array.from(otherElement.children).find(e => e.classList.contains("nav-card__overlay")).classList.remove("nav-card__overlay-selected");

    } else {
        throw Error("handleCardClick: card in neither Selected nor Unselected state!");
    }

    // finally, update the total to wrap #
    updateWrapTotal();
}

function handleSelectAll(event) {
    let currentElement = event.path.find(e => e.id.startsWith("select-all") || e.id.startsWith("deselect-all"));
    if (!currentElement) {
        throw Error("handleSelectAll: unable to find select button?!");
    }

    for (let i = 1; i <= numCards; i++) {
        switch (currentElement.id) {
            case "select-all-unwrapped":
                // hack- force all to deselected state so handleCardClick works right
                document.getElementById("nav-card-erc20-" + i).classList.remove("selected");
                document.getElementById("nav-card-erc20-" + i).classList.add("unselected");
                _handleCardClick(document.getElementById("nav-card-erc20-" + i), document.getElementById("nav-card-erc1155-" + i));
 
                break;
            case "deselect-all-unwrapped":
                // hack- force all to selected state so handleCardClick works right
                document.getElementById("nav-card-erc20-" + i).classList.remove("unselected");
                document.getElementById("nav-card-erc20-" + i).classList.add("selected");
                _handleCardClick(document.getElementById("nav-card-erc20-" + i), document.getElementById("nav-card-erc1155-" + i));
                break;
            case "select-all-wrapped":
                // hack- force all to deselected state so handleCardClick works right
                document.getElementById("nav-card-erc1155-" + i).classList.remove("selected");
                document.getElementById("nav-card-erc1155-" + i).classList.add("unselected");
                _handleCardClick(document.getElementById("nav-card-erc1155-" + i), document.getElementById("nav-card-erc20-" + i));
                break;
            case "deselect-all-wrapped":
                // hack- force all to selected state so handleCardClick works right
                document.getElementById("nav-card-erc1155-" + i).classList.remove("unselected");
                document.getElementById("nav-card-erc1155-" + i).classList.add("selected");
                _handleCardClick(document.getElementById("nav-card-erc1155-" + i), document.getElementById("nav-card-erc20-" + i));
                break;
        }
    }
}

function updateWrapTotal() {
    let totalToWrap = 0, totalToUnwrap = 0;
    for (let i = 1; i <= numCards; i++) {
        const wrapAmt = document.getElementById("to-wrap-" + i).value;
        if (Number(wrapAmt)) {
            totalToWrap += Number(wrapAmt);
        }
        const unwrapAmt = document.getElementById("to-unwrap-" + i).value;
        if (Number(unwrapAmt)) {
            totalToUnwrap += Number(unwrapAmt);
        }
    }

    document.getElementById("total-wrap").innerText = "Wrap " + totalToWrap + " Curio Cards";
    document.getElementById("total-unwrap").innerText = "Unwrap " + totalToUnwrap + " Curio Cards";
 }

async function calculateTotalToWrap() {
    // these will be used to calculate total for display, and to pass args to wrapBatch and unwrapBatch.

    let wrapitup = {
        "wrap": {
            1: null,
            2: null
        },
        "unwrap": {
            1: null,
            2: null
        }
    };

    for (let i = 1; i <= numCards; i++) {
        const wrapAmt = document.getElementById("to-wrap-" + i).value;
        wrapitup["wrap"][i] = Number(wrapAmt) || 0;
        const unwrapAmt = document.getElementById("to-unwrap-" + i).value;
        wrapitup["unwrap"][i] = Number(unwrapAmt) || 0;
    }
    
    return wrapitup;
}

async function handleWrapClick(event) {
    let currentElement = event.path.find(e => e.id == "wrap-button" || e.id == "unwrap-button");
    if (!currentElement) {
        throw Error("handleWrapClick: unable to find wrap/unwrap button element!");
    }

    let action = currentElement.id == "wrap-button" ? "wrap" : "unwrap";

    const wrapitup = await calculateTotalToWrap();
    console.debug("wrapitup: " + JSON.stringify(wrapitup));
    const wrapperContract = await new ethers.Contract(constants.wrapperAddr, constants.wrapperAbi, signer);
    const userAddr = await getUserAddr();

    // there's 4 possible functions to execute from here:
    // wrap or unwrap, if only 1 type of card to change
    // wrapBatch or unwrapBatch, if multiple types of card to change

    try {
        // First, test if there's only any cards to wrap.
        if (action == "wrap") {
            console.debug("handling wrap");
            // find nonzero values
            const nonzeroWrapValues = Object.keys(wrapitup["wrap"])
                .filter(key => wrapitup["wrap"][key] > 0)
                .reduce((res, key) => (res[key] = wrapitup["wrap"][key], res), {});
            console.debug("nonzeroWrapValues: " + JSON.stringify(nonzeroWrapValues));

            if (Object.keys(nonzeroWrapValues).length == 0) {
                console.debug("No values found to wrap!");
            } else if (Object.keys(nonzeroWrapValues).length == 1) {
                console.debug("Wrapping 1 type of card...");
                const cardId = Object.keys(nonzeroWrapValues)[0];
                const wrapNum = nonzeroWrapValues[cardId];

                console.debug("cardId: " + cardId);
                console.debug("wrapNum: " + wrapNum);

                const erc20Contract = await new ethers.Contract(constants.curioAddresses["CRO" + cardId], constants.erc20Abi, signer);
                // if we have approval already, skip
                const allowanceToSpend = await erc20Contract.allowance(userAddr, constants.wrapperAddr);
                console.debug("current allowance: " + allowanceToSpend);
                if (allowanceToSpend == 0) {
                    updateStatusBar("orange", true, "Executing transaction 1 of 2…");

                    // seek approval
                    const approvalResult = await erc20Contract.approve(constants.wrapperAddr, 2000);
                    console.debug("approvalResult:");
                    console.debug(approvalResult);
                    const receipt = await approvalResult.wait();
                    console.debug("receipt:");
                    console.debug(receipt);

                    updateStatusBar("orange", true, "Executing transaction 2 of 2…");
                } else {
                    updateStatusBar("orange", true, "Executing transaction 1 of 1…");
                }

                // perform wrap
                const wrapResult = await wrapperContract.wrap(cardId, wrapNum);
                console.debug("wrapResult:");
                const receipt2 = await wrapResult.wait();
                console.debug("receipt2:");
                console.debug(receipt2);

                // update balances
                populateBalances();

                // reset state of status bar
                updateStatusBar("green", false, "Wrap completed");
            } else {
                console.debug("Wrapping multiple types of cards...");

                // what do i gotta do here.
                // 1. get approvals for all erc20s that don't yet have approval
                // 2. submit bulk txn

                let approvalsRequired = [];
                for (let i = 0; i < Object.keys(nonzeroWrapValues).length; i++) {
                    const cardId = Object.keys(nonzeroWrapValues)[i];
                    console.debug("cardId: " + cardId);

                    const erc20Contract = await new ethers.Contract(constants.curioAddresses["CRO" + cardId], constants.erc20Abi, signer);
                    // if we have approval already, skip
                    const allowanceToSpend = await erc20Contract.allowance(userAddr, constants.wrapperAddr);
                    console.debug("current allowance: " + allowanceToSpend);
                    if (allowanceToSpend == 0) {
                        approvalsRequired.push(cardId);
                    }
                }

                console.debug(approvalsRequired.length + " approvals required. executing...");
                for (let i = 0; i < approvalsRequired.length; i++) {
                    // Update status bar with how many more transactions are required
                    updateStatusBar("orange", true, "Executing transaction " + (i+1) + " of " + (approvalsRequired.length+1) + "…");

                    // seek approval
                    const erc20Contract = await new ethers.Contract(constants.curioAddresses["CRO" + approvalsRequired[i]], constants.erc20Abi, signer);
                    const approvalResult = await erc20Contract.approve(constants.wrapperAddr, 2000);
                    console.debug("approvalResult:");
                    console.debug(approvalResult);
                    const receipt = await approvalResult.wait();
                    console.debug("receipt:");
                    console.debug(receipt);
                }

                // Update status bar with how many more transactions are required
                console.debug(approvalsRequired.length)
                console.debug(approvalsRequired.length+1)
                console.debug((approvalsRequired.length+1))
                updateStatusBar("orange", true, "Executing transaction " + (approvalsRequired.length+1) + " of " + (approvalsRequired.length+1) + "…");

                // perform wrap
                const cardIdList = Object.keys(nonzeroWrapValues);
                let wrapNumList = [];
                for (let i = 0; i < cardIdList.length; i++) {
                    wrapNumList.push(nonzeroWrapValues[cardIdList[i]]);
                }
                console.debug("About to wrap card IDs " + JSON.stringify(cardIdList) + " with balances " + JSON.stringify(wrapNumList));
                const wrapResult = await wrapperContract.wrapBatch(cardIdList, wrapNumList);
                console.debug("wrapResult:");
                const receipt = await wrapResult.wait();
                console.debug("receipt:");
                console.debug(receipt);

                // update balances
                populateBalances();

                // reset state of status bar
                updateStatusBar("green", false, "Wrap completed");
            }

        } else {
            console.debug("handling unwrap");

            // find nonzero values
            const nonzeroUnwrapValues = Object.keys(wrapitup["unwrap"])
                .filter(key => wrapitup["unwrap"][key] > 0)
                .reduce((res, key) => (res[key] = wrapitup["unwrap"][key], res), {});
            console.debug("nonzeroUnwrapValues: " + JSON.stringify(nonzeroUnwrapValues));

            if (Object.keys(nonzeroUnwrapValues).length == 0) {
                console.debug("No values found to unwrap!");
            } else if (Object.keys(nonzeroUnwrapValues).length == 1) {
                console.debug("Unwrapping 1 type of card...");
                const cardId = Object.keys(nonzeroUnwrapValues)[0];
                const unwrapNum = nonzeroUnwrapValues[cardId];

                console.debug(wrapperContract.unwrap);
                console.debug("cardId: " + cardId);
                console.debug("unwrapNum: " + unwrapNum);

                updateStatusBar("orange", true, "Executing transaction 1 of 1…");
                const unwrapResult = await wrapperContract.unwrap(cardId, unwrapNum);
                console.debug("unwrapResult:");
                const receipt2 = await unwrapResult.wait();
                console.debug("receipt2:");
                console.debug(receipt2);

                // update balances
                populateBalances();

                // reset state of status bar
                updateStatusBar("green", false, "Unwrap completed");
            } else {
                console.debug("Unwrapping multiple types of cards...");

                const cardIdList = Object.keys(nonzeroUnwrapValues);
                let unwrapNumList = [];
                for (let i = 0; i < cardIdList.length; i++) {
                    unwrapNumList.push(nonzeroUnwrapValues[cardIdList[i]]);
                }

                updateStatusBar("orange", true, "Executing transaction 1 of 1…");
                console.debug("About to unwrap card IDs " + JSON.stringify(cardIdList) + " with balances " + JSON.stringify(unwrapNumList));
                const unwrapResult = await wrapperContract.unwrapBatch(cardIdList, unwrapNumList);
                console.debug("unwrapResult:");
                const receipt = await unwrapResult.wait();
                console.debug("receipt:");
                console.debug(receipt);

                // update balances
                populateBalances();

                // reset state of status bar
                updateStatusBar("green", false, "Unwrap completed");
            }
        }
    } catch (e) {
        if (e.code) {
            console.warn("Received Metamask errorcode: " + e.code);
            if (e.code == 4001) {
                updateStatusBar("red", false, "Metamask error 4001: User denied transaction signature");
            } else {
                updateStatusBar("red", false, "Metamask error " + e.code);
            }
        }

        // rethrow for logging
        throw e;
    }
}

// This exists for debug purposes
async function revokeApproval() {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const i = 2; // which curio card to revoke?

    console.debug("Revoking approval for card " + i);
    const erc20Contract = await new ethers.Contract(constants.curioAddresses["CRO" + i], constants.erc20Abi, signer);
    const approvalResult = await erc20Contract.approve(constants.wrapperAddr, 0);
    console.debug("approvalResult:");
    console.debug(approvalResult);
    const receipt = await approvalResult.wait();
    console.debug("receipt:");
    console.debug(receipt);
}

async function populateBalances() {
    console.debug("populateBalances");
    const userAddr = await getUserAddr();
    if (!userAddr) {
        throw Error("populateBalances(): Unable to fetch user address!");
    }

    // populate erc20 balances
    for (let i = 1; i <= numCards; i++) {
        const currentSymbol = "CRO" + i;
        getErc20Balance(constants.curioAddresses[currentSymbol], userAddr).then(balance => {
            console.debug("erc20 " + currentSymbol + " balance: " + balance);
            document.getElementById("nav-card-erc20-" + i + "-balance").innerText = balance;
            document.getElementById("main-card-erc20-" + i + "-balance").innerText = balance;
            // set max value for input field
            document.getElementById("to-wrap-" + i).max = balance;
        });
    }

    // populate erc1155 balances
    getErc1155BalanceBatch(constants.wrapperAddr, userAddr).then(balances => {
        console.debug("erc1155 balances: " + balances);
        for (let i = 1; i <= numCards; i++) {
            console.debug("erc1155 id " + i + " balance: " + balances[i-1]);
            document.getElementById("nav-card-erc1155-" + i + "-balance").innerText = balances[i-1];
            document.getElementById("main-card-erc1155-" + i + "-balance").innerText = balances[i-1];
            // set max value for input field
            document.getElementById("to-unwrap-" + i).max = balances[i-1];
        }
    });

    // TODO reset <input> fields back to 0
    for (let i = 1; i <= numCards; i++) {
        document.getElementById("to-wrap-" + i).value = "";
        document.getElementById("to-unwrap-" + i).value = "";
    }
}

// work to perform after connection is established
async function postConnection() {
    // update status bar
    resetStatusBarToGreen();

    // populate cards dynamically
    for (let i = 1; i <= numCards; i++) {
        document.getElementById("nav").innerHTML += `
        <article id="nav-card-erc20-${i}" class="nav-card unselected">
            <div class="nav-card__overlay"></div>
            <img class="nav-card__image" src="${images[i]}" alt="Curio${i}">
            <div class="label__wrapper">
                <p class="cell cell__white">CRO${i}</p>
                <div class="balance__container">
                    <p class="cell cell__white">Balance</p><p id="nav-card-erc20-${i}-balance" class="cell cell__red">0</p>
                </div>
            </div>
        </article>

        <div class="spacer"></div>

        <article id="nav-card-erc1155-${i}" class="nav-card unselected">
            <div class="nav-card__overlay"></div>
            <img class="nav-card__image" src="${images[i]}" alt="Curio${i}">
            <div class="label__wrapper">
                <p class="cell cell__red">WRAPPED</p>
                <p class="cell cell__white">CRO${i}</p>
                <div class="balance__container">
                    <p class="cell cell__white">Balance</p><p id="nav-card-erc1155-${i}-balance" class="cell cell__red">0</p>
                </div>
            </div>
        </article>
`;
        document.getElementById("rows").innerHTML += `
            <article id="row-${i}" class="row hidden">
                <header class="row__header cell cell__red">CRO${i}</header>
                <div class="row__gridfucker">
                    <p class="balance-label cell">Unwrapped Balance</p>
                    <p class="balance-value cell" id="main-card-erc20-${i}-balance">0</p>
                    <p class="balance-label cell">Wrapped Balance</p>
                    <p class="balance-value cell" id="main-card-erc1155-${i}-balance">0</p>
                    <label for="wrap" class="balance-label cell">How many to wrap?</label>
                    <input for="wrap" id="to-wrap-${i}" class="how-many-input cell cell__pink" type="number" placeholder="0" min="0" max="2000"></input>
                    <label for="unwrap" class="balance-label cell">How many to unwrap?</label>
                    <input for="unwrap" id="to-unwrap-${i}" class="how-many-input cell cell__pink" type="number" placeholder="0" min="0" max="2000"></input>
                </div>
            </article>
`;
    }

    await populateBalances();

    // bind event listeners to nav cards
    for (let i = 1; i <= numCards; i++) {
        const erc20Element = document.getElementById("nav-card-erc20-" + i);
        erc20Element.addEventListener("click", handleCardClick);
        erc20Element.classList.add("pointer");
        const erc1155Element = document.getElementById("nav-card-erc1155-" + i);
        erc1155Element.addEventListener("click", handleCardClick);
        erc1155Element.classList.add("pointer");
    }

    // bind event listeners to select/unselect all buttons
    document.getElementById("select-all-wrapped").addEventListener("click", handleSelectAll);
    document.getElementById("deselect-all-wrapped").addEventListener("click", handleSelectAll);
    document.getElementById("select-all-unwrapped").addEventListener("click", handleSelectAll);
    document.getElementById("deselect-all-unwrapped").addEventListener("click", handleSelectAll);

    // bind event listeners to Wrap and Unwrap buttons
    const wrapButton = document.getElementById("wrap-button");
    wrapButton.addEventListener("click", handleWrapClick);
    wrapButton.classList.add("pointer");

    const unwrapButton = document.getElementById("unwrap-button");
    unwrapButton.addEventListener("click", handleWrapClick);
    unwrapButton.classList.add("pointer");

    // bind event listeners to <input> fields
    for (let i = 1; i <= numCards; i++) {
        document.getElementById("to-wrap-" + i).addEventListener("input", updateWrapTotal);
        document.getElementById("to-unwrap-" + i).addEventListener("input", updateWrapTotal);
    }
}

async function initialize() {
    console.debug("initialize");

    if (!provider) {
        console.error("Your browser is not web3 enabled.");
        document.getElementById("install-metamask").classList.remove("hidden");
        return;
    }

    getUserAddr().then(userAddr => {
        if (userAddr) {
            // already connected
            document.getElementById("connect-wallet").remove();
            document.getElementById("click-da-cards").classList.remove("hidden");
            postConnection();
        } else {
            // prompt user to connect
            updateStatusBar("orange", false, "Connect your wallet to continue");
            document.getElementById("connect-wallet").classList.remove("hidden");
            document.getElementById("connect-wallet-button").addEventListener("click", connectWallet);
        }
    });
}

window.addEventListener('DOMContentLoaded', initialize);
