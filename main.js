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
    }).then(async () => {
        const accts = await provider.listAccounts();
        if (accts.length > 0) {
            fillAddress(accts[0]);
            document.getElementById("web3").removeEventListener("click", connectWallet);
            document.getElementById("web3").classList.remove("pointer");
        }
    });
}

function fillAddress(addr) {
    document.getElementById("web3").innerText = "connected as " + addr.substring(0, 5) + "…" + addr.substring(addr.length-3);
}

async function initialize() {
    console.log("initialize");
    //console.log(JSON.stringify(constants.wrapperAbi));

    // detect if metamask is already connected; set button in top right
    await provider.listAccounts().then(accts => {
        if (accts.length > 0) {
            console.log("connected! " + JSON.stringify(accts));
            fillAddress(accts[0]);
        } else {
            console.log("not yet connected!");
            document.getElementById("web3").addEventListener("click", connectWallet);
            document.getElementById("web3").classList.add("pointer");

        }
    });
}

console.log("about to init")
window.addEventListener('DOMContentLoaded', initialize);
