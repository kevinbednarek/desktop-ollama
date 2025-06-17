import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';

let streamChatInputEl: HTMLInputElement | null;
let streamChatMsgEl: HTMLElement | null;
let streamChatButtonEl: HTMLButtonElement | null;
let modelSelectEl: HTMLSelectElement | null;
let modelDownloadInputEl: HTMLInputElement | null;
let modelDownloadButtonEl: HTMLButtonElement | null;
let modelDeleteInputEl: HTMLInputElement | null;
let modelDeleteButtonEl: HTMLButtonElement | null;

async function streamChat() {
  if (streamChatMsgEl && streamChatInputEl && streamChatButtonEl) {
    streamChatButtonEl.textContent = "Thinking...";
    let accumulatedResponse = ""; // Initialize an empty string to accumulate messages

    const unlisten = await listen("chat-message", (event) => {
      // @ts-ignore
      if (event.payload && event.payload.message) {
        // @ts-ignore
        accumulatedResponse += event.payload.message; // Append the message to the accumulated string
        // @ts-ignore
        streamChatMsgEl.textContent = accumulatedResponse; // Update the element's text content
        // @ts-ignore //TODO: Do I need this..?
        streamChatMsgEl.scrollTop = streamChatMsgEl.scrollHeight; // Auto-scroll to the bottom
      }
    });


    await invoke("chat", {
      "request": {
        model: modelSelectEl?.value,
        prompt: streamChatInputEl.value,
      }
    });

    unlisten();
    streamChatButtonEl.textContent = "Chat";
    streamChatInputEl.value = "";
  }
}

async function getModels() {
  if (modelSelectEl) {
    // Fetch the models from the Rust backend
    const models: string[] = await invoke("get_models");

    // Clear existing options
    modelSelectEl.innerHTML = "";

    // Add new options to the select element
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      // @ts-ignore
      modelSelectEl.appendChild(option);
    });
  }
}

async function downloadModel() {
  if (modelDownloadInputEl && modelSelectEl && modelDownloadButtonEl) {
    modelDownloadButtonEl.textContent = "Downloading...";
    const modelName = modelDownloadInputEl.value;

    // Call the Rust function to download the model
    let res = await invoke("download_model", { modelName: modelName });
    if (res) {
      alert(res + " downloaded successfully!");
    } else {
      alert("Failed to download " + modelName);
    }

    // Clear the input field
    modelDownloadInputEl.textContent = "";
    // Reset the button text
    modelDownloadButtonEl.textContent = "Download";
    // Fetch the models from the Rust backend
    getModels();
  }
}

async function deleteModel() {
  console.log("Inside downloadModel function");

  if (modelDeleteInputEl && modelSelectEl && modelDeleteButtonEl) {
    modelDeleteButtonEl.textContent = "Deleting...";
    const modelName = modelDeleteInputEl.value;
    console.log("Trying to download model: " + modelName);

    // Call the Rust function to download the model
    let res = await invoke("delete_model", { modelName: modelName });
    if (res) {
      alert(res + " deleted successfully!");
    } else {
      alert("Failed to delete " + modelName);
    }

    // Clear the input field
    modelDeleteInputEl.textContent = "";
    // Reset the button text
    modelDeleteButtonEl.textContent = "Delete";
    // Fetch the models from the Rust backend
    getModels();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  streamChatInputEl = document.querySelector("#stream-chat-input");
  streamChatMsgEl = document.querySelector("#stream-chat-msg");
  streamChatButtonEl = document.querySelector("#chat-button");
  modelSelectEl = document.querySelector("#model-select");
  modelDownloadInputEl = document.querySelector("#model-download-input");
  modelDownloadButtonEl = document.querySelector("#model-download-button");
  modelDeleteInputEl = document.querySelector("#model-delete-input");
  modelDeleteButtonEl = document.querySelector("#model-delete-button");

  getModels();

  document.querySelector("#stream-chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    streamChat();
  });

  document.querySelector("#model-download-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    downloadModel();
  });

  document.querySelector("#model-delete-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    deleteModel();
  });

  // document.querySelector("#model-button")?.addEventListener("click", (e) => {
  //   e.preventDefault();
  //   getModels();
  // });
});
