import { ethers } from "ethers";
import 'regenerator-runtime/runtime'
import * as constants from "./constants.js"

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
    postConnection(accts[0]);
}

async function getErc20Balance(tokenAddr, userAddr) {
    //console.log("fetching balance for tokenAddr: " + tokenAddr);
    //await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

    const contract = await new ethers.Contract(tokenAddr, constants.erc20Abi, provider);
    const balance = await contract.balanceOf(userAddr);
    //console.log("balance: " + balance);
    return balance;
}

// work to perform after connection is established
async function postConnection(userAddr) {
    // populate address in top right
    document.getElementById("web3").innerText = "connected as " + userAddr.substring(0, 5) + "…" + userAddr.substring(userAddr.length-3);

    // populate erc20 balances
    for (let i = 1; i < 30; i++) {
        const currentSymbol = "CRO" + i;
        getErc20Balance(constants.curioAddresses[currentSymbol], userAddr).then(balance => {
            console.log("populating " + currentSymbol);
            console.log("balance: " + balance);
            document.getElementById("nav-card-" + i + "-balance").innerText = balance;
        });
    }
}

async function initialize() {
    console.log("initialize");
    //console.log(JSON.stringify(constants.wrapperAbi));

    // detect if metamask is already connected; set button in top right
    provider.listAccounts().then(accts => {
        if (accts.length > 0) {
            console.log("connected! " + JSON.stringify(accts));
            postConnection(accts[0]);
        } else {
            console.log("not yet connected!");
            document.getElementById("web3").addEventListener("click", connectWallet);
            document.getElementById("web3").classList.add("pointer");
        }
    });

}

window.addEventListener('DOMContentLoaded', initialize);
