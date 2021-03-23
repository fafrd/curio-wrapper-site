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
}

async function initialize() {
    console.log("initialize");
    //console.log(JSON.stringify(constants.wrapperAbi));

    // detect if metamask is already connected; set button in top right
    await provider.listAccounts().then(accts => {
        if (accts.length > 0) {
            console.log("connected! " + JSON.stringify(accts));
            const currentAcct = accts[0];
            document.getElementById("web3").innerText = currentAcct.substring(0, 5) + "…" + currentAcct.substring(currentAcct.length-3);
        } else {
            console.log("not yet connected!");
            document.getElementById("web3").addEventListener("click", connectWallet);
        }
    });
}



console.log("about to init")
window.addEventListener('DOMContentLoaded', initialize);
