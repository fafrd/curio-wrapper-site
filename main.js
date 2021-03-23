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

function fillAddress(addr) {
    document.getElementById("web3").innerText = "connected as " + addr.substring(0, 5) + "…" + addr.substring(addr.length-3);
}

const getKiancoinContract = async () => await new ethers.Contract(kianAddress, kianAbi, provider);
async function getErc20Balance(tokenAddr, userAddr) {
    console.log("fetching balance for tokenAddr: " + tokenAddr);
    const contract = await new ethers.Contract(tokenAddr, constants.erc20Abi, provider);
    const balance = await contract.balanceOf(userAddr);
    console.log("balance: " + balance);
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

// work to perform after connection is established
async function postConnection(userAddr) {
    fillAddress(userAddr);
    // pull down the user's card info
    const result = getErc20Balance(constants.curioAddresses["CRO1"], userAddr);
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
