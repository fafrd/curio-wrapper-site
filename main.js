import { ethers } from "ethers";
import 'regenerator-runtime/runtime'
//import * as constants from "./constants.js"
import * as constants from "./rinkeby-constants.js"

// Override the owner address. Used instead of metamask address if set
//const debugAddress = "0x3be11d51f5b1353b305eaf926376ed437634c3dc";
//const debugAddress = "0x85a9d6258b6a2cc264fdbfb60c5e3d2678b4ef7e";
const debugAddress = "0x49468f702436d1e590895ffa7155bcd393ce52ae";

const numCards = 2; // debug

const { ethereum } = window;
if (ethereum) {
    var provider = new ethers.providers.Web3Provider(ethereum);
}

function isEthereumAvailable() {
    Boolean(ethereum);
}

async function connectWallet() {
    console.log("connectWallet");
    await ethereum.request({
        method: 'eth_requestAccounts'
    });
    const accts = await provider.listAccounts();
    if (accts.length > 0) {
        document.getElementById("web3").removeEventListener("click", connectWallet);
        document.getElementById("web3").classList.remove("pointer");
    } else {
        throw Error("Connected to ethereum but provider.listAccounts() returned empty!");
    }

    // once connected, perform the next tasks, like populating token balances
    postConnection(debugAddress || accts[0]);
}

async function getErc20Balance(tokenAddr, userAddr) {
    //console.log("fetching balance for tokenAddr: " + tokenAddr);
    //await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

    const contract = await new ethers.Contract(tokenAddr, constants.erc20Abi, provider);
    return await contract.balanceOf(userAddr);
}

async function getErc1155BalanceBatch(contractAddr, userAddr) {
    const contract = await new ethers.Contract(contractAddr, constants.wrapperAbi, provider);
    console.log("querying batch... ");
    console.log(contract["balanceOfBatch(address[],uint256[])"]);
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

    if (currentElement.id.startsWith("nav-card-erc20")) {
        currentCard = Number(currentElement.id.substring(15));
        currentType = "erc20";
        otherElement = document.getElementById("nav-card-erc1155-" + currentCard);
    } else if (currentElement.id.startsWith("nav-card-erc1155")) {
        currentCard = Number(currentElement.id.substring(17));
        currentType = "erc1155";
        otherElement = document.getElementById("nav-card-erc20-" + currentCard);
    }

    console.log("handleCardClick: " + currentType + " #" + currentCard);

    console.log(currentElement.classList);
    if (currentElement.classList.contains("unselected")) {
        // card is unselected- set to selected
        currentElement.classList.remove("unselected");
        currentElement.classList.add("selected");
        otherElement.classList.remove("unselected");
        otherElement.classList.add("selected");

        // unhide table row
        document.getElementById("row-" + currentCard).classList.remove("row-displaynone");
        document.getElementById("row-" + currentCard).classList.add("row-displayinitial");

        // TODO: apply overlay indicating the card is 'selected'
        //set currentElement and otherElement to have the selected class

    } else if (currentElement.classList.contains("selected")) {
        // card is selected- set to unselected
        currentElement.classList.remove("selected");
        currentElement.classList.add("unselected");
        otherElement.classList.remove("selected");
        otherElement.classList.add("unselected");

        // hide table row
        document.getElementById("row-" + currentCard).classList.remove("row-displayinitial");
        document.getElementById("row-" + currentCard).classList.add("row-displaynone");

        // TODO: set how-many-input for row-X to 0, because it's no longer visible

        // TODO: apply overlay indicating the card is no longer 'selected'
        //set currentElement and otherElement to remove the selected class

    } else {
        throw Error("handleCardClick: card in neither Selected nor Unselected state!");
    }
}

async function handleWrapClick(event) {

}

// work to perform after connection is established
async function postConnection(userAddr) {
    // populate address in top right
    document.getElementById("web3").innerText = "Connected as " + userAddr.substring(0, 5) + "…" + userAddr.substring(userAddr.length-3);

    // populate erc20 balances
    for (let i = 1; i <= numCards; i++) {
        const currentSymbol = "CRO" + i;
        getErc20Balance(constants.curioAddresses[currentSymbol], userAddr).then(balance => {
            console.log("erc20 " + currentSymbol + " balance: " + balance);
            document.getElementById("nav-card-erc20-" + i + "-balance").innerText = balance;
            document.getElementById("main-card-erc20-" + i + "-balance").innerText = balance;
        });
    }

    // populate erc1155 balances
    getErc1155BalanceBatch(constants.wrapperAddr, userAddr).then(balances => {
        console.log("erc1155 balances: " + balances);
        for (let i = 1; i <= numCards; i++) {
            console.log("erc1155 id " + i + " balance: " + balances[i-1]);
            document.getElementById("nav-card-erc1155-" + i + "-balance").innerText = balances[i-1];
            document.getElementById("main-card-erc1155-" + i + "-balance").innerText = balances[i-1];
        }
    });

    // bind event listeners to nav cards
    for (let i = 1; i <= numCards; i++) {
        const erc20Element = document.getElementById("nav-card-erc20-" + i);
        erc20Element.addEventListener("click", handleCardClick);
        erc20Element.classList.add("pointer");
        const erc1155Element = document.getElementById("nav-card-erc1155-" + i);
        erc1155Element.addEventListener("click", handleCardClick);
        erc1155Element.classList.add("pointer");
    }
}

async function initialize() {
    console.log("initialize");
    //console.log(JSON.stringify(constants.wrapperAbi));

    // detect if metamask is already connected; set button in top right
    provider.listAccounts().then(accts => {
        if (accts.length > 0) {
            console.log("connected! " + debugAddress || JSON.stringify(accts));
            postConnection(debugAddress || accts[0]);
        } else {
            console.log("not yet connected!");
            document.getElementById("web3").addEventListener("click", connectWallet);
            document.getElementById("web3").classList.add("pointer");
        }
    });

}

window.addEventListener('DOMContentLoaded', initialize);
