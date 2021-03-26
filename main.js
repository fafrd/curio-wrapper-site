import { ethers } from "ethers";
import 'regenerator-runtime/runtime'
//import * as constants from "./constants.js"
import * as constants from "./rinkeby-constants.js"

// Override the owner address. Used instead of metamask address if set
var debugAddress;
//debugAddress = "0x3be11d51f5b1353b305eaf926376ed437634c3dc";
//debugAddress = "0x85a9d6258b6a2cc264fdbfb60c5e3d2678b4ef7e";
//debugAddress = "0x49468f702436d1e590895ffa7155bcd393ce52ae";

const numCards = 2; // debug

const { ethereum } = window;
if (ethereum) {
    var provider = new ethers.providers.Web3Provider(ethereum);
    var signer = provider.getSigner();
}

function isEthereumAvailable() {
    Boolean(ethereum);
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

    // make connection circle happy
    document.getElementById("connection-indicator").classList.remove("circle-orange");
    document.getElementById("connection-indicator").classList.add("circle-green");
    // once connected, perform the next tasks, like populating token balances
    postConnection(debugAddress || accts[0]);
    // show "click the cards" helper image
    document.getElementById("click-da-cards").classList.remove("hidden");
}

async function getUserAddr() {
    return await provider.listAccounts().then(accts => {
        if (accts.length > 0) {
            console.debug("connected! " + (debugAddress || JSON.stringify(accts)));
            return (debugAddress || accts[0]);
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
    let currentCard, currentType;
    let currentElement, otherElement; // otherElement is erc1155 if current is erc20, etc
    currentElement = event.path.find(e => e.localName == "article");
    if (!currentElement) {
        throw Error("handleCardClick: unable to find <article> element!");
    }

    // remove "click the cards" helper image
    if (document.getElementById("click-da-cards")) {
        document.getElementById("click-da-cards").remove();
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

    //console.debug("handleCardClick: " + currentType + " #" + currentCard);

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

        // TODO: set how-many-input for row-X to 0, because it's no longer visible

        Array.from(currentElement.children).find(e => e.localName == "img").classList.remove("nav-card__grayscale");
        Array.from(otherElement.children).find(e => e.localName == "img").classList.remove("nav-card__grayscale");

        Array.from(currentElement.children).find(e => e.classList.contains("nav-card__overlay")).classList.remove("nav-card__overlay-selected");
        Array.from(otherElement.children).find(e => e.classList.contains("nav-card__overlay")).classList.remove("nav-card__overlay-selected");

    } else {
        throw Error("handleCardClick: card in neither Selected nor Unselected state!");
    }
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

    // there's 4 possible functions to execute from here:
    // wrap or unwrap, if only 1 type of card to change
    // wrapBatch or unwrapBatch, if multiple types of card to change

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

            console.debug(wrapperContract.wrap);
            console.debug("cardId: " + cardId);
            console.debug("wrapNum: " + wrapNum);

            const erc20Contract = await new ethers.Contract(constants.curioAddresses["CRO" + cardId], constants.erc20Abi, signer);
            const approvalResult = await erc20Contract.approve(constants.wrapperAddr, 2000);
            console.debug("approvalResult:");
            console.debug(approvalResult);
            const receipt = await approvalResult.wait();
            console.debug("receipt:");
            console.debug(receipt);

            const wrapResult = await wrapperContract.wrap(cardId, wrapNum);
            console.debug("wrapResult:");
            const receipt2 = await wrapResult.wait();
            console.debug("receipt2:");
            console.debug(receipt2);

            // finally, update balances
            populateBalances();
        } else {
            console.debug("Wrapping multiple types of cards...");

            console.error("not yet implemented"); // TODO
        }

    } else {
        console.debug("handling unwrap");

        // find nonzero values
        const nonzeroUnwrapValues = Object.keys(wrapitup["unwrap"])
            .filter(key => wrapitup["unwrap"][key] > 0)
            .reduce((res, key) => (res[key] = wrapitup["unwrap"][key], res), {});
        console.debug("nonzeroUnwrapValues: " + JSON.stringify(nonzeroUnwrapValues));

        if (Object.keys(nonzeroUnwrapValues).length == 0) {
            console.debug("No values found to wrap!");
        } else if (Object.keys(nonzeroUnwrapValues).length == 1) {
            console.debug("Unwrapping 1 type of card...");
            const cardId = Object.keys(nonzeroUnwrapValues)[0];
            const unwrapNum = nonzeroUnwrapValues[cardId];

            console.debug(wrapperContract.unwrap);
            console.debug("cardId: " + cardId);
            console.debug("unwrapNum: " + unwrapNum);

            const unwrapResult = await wrapperContract.unwrap(cardId, unwrapNum);
            console.debug("unwrapResult:");
            const receipt2 = await unwrapResult.wait();
            console.debug("receipt2:");
            console.debug(receipt2);

            // finally, update balances
            populateBalances();
        } else {
            console.debug("Unwrapping multiple types of cards...");

            console.error("not yet implemented"); // TODO
        }

    }
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
        });
    }

    // populate erc1155 balances
    getErc1155BalanceBatch(constants.wrapperAddr, userAddr).then(balances => {
        console.debug("erc1155 balances: " + balances);
        for (let i = 1; i <= numCards; i++) {
            console.debug("erc1155 id " + i + " balance: " + balances[i-1]);
            document.getElementById("nav-card-erc1155-" + i + "-balance").innerText = balances[i-1];
            document.getElementById("main-card-erc1155-" + i + "-balance").innerText = balances[i-1];
        }
    });
}

// work to perform after connection is established
async function postConnection(userAddr) {
    // populate address in top bar
    document.getElementById("web3").innerText = "Connected as " + userAddr.substring(0, 5) + "…" + userAddr.substring(userAddr.length-3);

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

    // bind event listeners to Wrap and Unwrap buttons
    const wrapButton = document.getElementById("wrap-button");
    wrapButton.addEventListener("click", handleWrapClick);
    wrapButton.classList.add("pointer");

    const unwrapButton = document.getElementById("unwrap-button");
    unwrapButton.addEventListener("click", handleWrapClick);
    unwrapButton.classList.add("pointer");
}

async function initialize() {
    console.debug("initialize");

    if (debugAddress) {
        console.error("WARNING! WEBSITE IN DEBUG MODE: user address forced to " + debugAddress);
    }

    if (!provider) {
        console.error("Your browser is not web3 enabled.");
        document.getElementById("install-metamask").classList.remove("hidden");
        return;
    }

    getUserAddr().then(userAddr => {
        if (userAddr) {
            // already connected
            document.getElementById("connection-indicator").classList.add("circle-green");
            document.getElementById("connect-wallet").remove();
            document.getElementById("click-da-cards").classList.remove("hidden");
            postConnection(userAddr);
        } else {
            // prompt user to connect
            document.getElementById("connection-indicator").classList.add("circle-orange");
            document.getElementById("web3").innerText = "Connect your wallet to continue";
            document.getElementById("connect-wallet").classList.remove("hidden");
            document.getElementById("connect-wallet-button").addEventListener("click", connectWallet);
        }
    });
}

window.addEventListener('DOMContentLoaded', initialize);
