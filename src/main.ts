import {invoke} from "@tauri-apps/api/core";
import {listen} from '@tauri-apps/api/event';

// Global error listener: always active
listen("error", (event) => {
    const banner = document.getElementById("error-banner");
    const msg = document.getElementById("error-banner-message");
    if (banner && msg) {
        // @ts-ignore
        msg.textContent = event.payload;
        banner.style.display = "flex";
    }
    // Reset button states on error
    if (modelDownloadButtonEl) {
        modelDownloadButtonEl.textContent = "Download";
        modelDownloadButtonEl.disabled = false;
    }
    if (streamChatButtonEl) {
        streamChatButtonEl.textContent = "Chat";
        streamChatButtonEl.disabled = false;
    }
    // Add more button resets as needed
});

// Banner close logic
window.addEventListener("DOMContentLoaded", () => {
    const errorBanner = document.getElementById("error-banner");
    const errorBannerClose = document.getElementById("error-banner-close");
    if (errorBanner && errorBannerClose) {
        errorBannerClose.addEventListener("click", () => {
            errorBanner.style.display = "none";
        });
        // Close error banner when clicking outside of it
        window.addEventListener("mousedown", (e) => {
            if (errorBanner.style.display !== "none" && !errorBanner.contains(e.target as Node)) {
                errorBanner.style.display = "none";
            }
        });
    }

    streamChatInputEl = document.querySelector("#stream-chat-input");
    streamChatMsgEl = document.querySelector("#stream-chat-msg");
    streamChatButtonEl = document.querySelector("#chat-button");
    modelSelectEl = document.querySelector("#model-select");
    modelDownloadInputEl = document.querySelector("#model-download-input");
    modelDownloadButtonEl = document.querySelector("#model-download-button");

    // @ts-ignore
    init();
    listen<Model[]>('model-list-update', (event) => {
        console.log(
            `Models: ${JSON.stringify(event.payload.map(model => model.name))}`
        );
        models = event.payload;
        console.log("Model count: " + models.length);
        getModels();
        updateChatInputPlaceholderForSelectedModel();
    });


    document.querySelector("#stream-chat-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        chat();
    });

    document.querySelector("#model-download-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        downloadModel();
    });

    document.querySelector("#model-delete-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        deleteModel();
    });

    document.querySelector("#new-conversation-btn")?.addEventListener("click", () => {
        newConversation();
    });

    // Update chat input placeholder on select change
    if (modelSelectEl) {
        modelSelectEl.addEventListener("change", updateChatInputPlaceholderForSelectedModel);
    }

    // Modal close logic
    const modal = document.getElementById("model-info-modal");
    const modalClose = document.getElementById("model-info-modal-close");
    if (modal && modalClose) {
        modalClose.addEventListener("click", () => {
            modal.style.display = "none";
        });
        // Close modal when clicking outside modal-content
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });
    }
});
type Model = {
    name: string,
    license: string,
    parameters: string,
    template: string,
    modelFile: string,
    modelInfo: Map<string, any>,
    capabilities: string[],
}

let models: Model[] = [];

let streamChatInputEl: HTMLInputElement | null;
let streamChatMsgEl: HTMLElement | null;
let streamChatButtonEl: HTMLButtonElement | null;
let modelSelectEl: HTMLSelectElement | null;
let modelDownloadInputEl: HTMLInputElement | null;
let modelDownloadButtonEl: HTMLButtonElement | null;

let conversation: { role: "user" | "assistant", content: string }[] = [];

function renderConversation() {
    if (!streamChatMsgEl) return;
    streamChatMsgEl.innerHTML = "";
    conversation.forEach(msg => {
        const div = document.createElement("div");
        div.className = `chat-bubble ${msg.role}`;
        div.textContent = msg.content;
        streamChatMsgEl?.appendChild(div);
    });
    streamChatMsgEl.scrollTop = streamChatMsgEl.scrollHeight;
}

async function chat() {
    if (streamChatMsgEl && streamChatInputEl && streamChatButtonEl) {
        const userInput = streamChatInputEl.value;
        if (!userInput.trim()) return;
        streamChatButtonEl.textContent = "Thinking...";
        // Add user message to conversation
        conversation.push({ role: "user", content: userInput });
        renderConversation();
        let accumulatedResponse = "";
        let assistantIndex = conversation.length;
        // Reserve a spot for the assistant's message
        conversation.push({ role: "assistant", content: "" });
        renderConversation();
        const unlisten = await listen("chat-message", (event) => {
            // @ts-ignore
            if (event.payload && event.payload.message) {
                // @ts-ignore
                accumulatedResponse += event.payload.message;
                // Update the last assistant message in the conversation
                conversation[assistantIndex] = { role: "assistant", content: accumulatedResponse };
                renderConversation();
            }
        });
        await invoke("chat", {
            "request": {
                model: modelSelectEl?.value,
                prompt: userInput,
            }
        });
        unlisten();
        streamChatButtonEl.textContent = "Chat";
        streamChatInputEl.value = "";
    }
}

async function newConversation() {
    await invoke("new_conversation");
    conversation = [];
    renderConversation();
}

//Takes the shared Model list and populates all relevant UI elements
async function getModels() {
    if (modelSelectEl) {
        console.log("Updating HTML select options");
        modelSelectEl.innerHTML = "";
        models.forEach((model) => {
            console.log("Adding model to select element: " + model.name);
            const option = document.createElement("option");
            option.value = model.name;
            option.textContent = model.name;
            modelSelectEl?.appendChild(option);
        });
    }
    const modelsListEl = document.querySelector("#models-list");
    if (modelsListEl) {
        modelsListEl.innerHTML = "";
        models.forEach((model) => {
            console.log("Adding model to model list: " + model.name);
            const li = document.createElement("li");
            const modelLink = document.createElement("a");
            modelLink.href = "#";
            modelLink.textContent = model.name;
            modelLink.addEventListener("click", (e) => {
                e.preventDefault();
                showModelInfo(model.name);
            });
            li.appendChild(modelLink);
            const trash = document.createElement("span");
            trash.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'></polyline><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'></path><line x1='10' y1='11' x2='10' y2='17'></line><line x1='14' y1='11' x2='14' y2='17'></line></svg>`;
            trash.style.cursor = "pointer";
            trash.title = "Delete model";
            trash.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteModel(model.name);
            });
            li.appendChild(trash);
            modelsListEl.appendChild(li);
        });
    }
}

async function downloadModel() {
    alert("Downloading model... This may take a while, please be patient.");
    if (modelDownloadInputEl && modelSelectEl && modelDownloadButtonEl) {
        modelDownloadButtonEl.textContent = "Downloading...";
        modelDownloadButtonEl.disabled = true;
        const modelName = modelDownloadInputEl.value;
        modelDownloadInputEl.textContent = "";
        modelDownloadInputEl.value = "";

        // Call the Rust function to download the model
        let res = await invoke("download_model", {modelName: modelName});
        if (res) {
            alert(res + " downloaded successfully!");
        } else {
            alert("Failed to download " + modelName);
        }

        // Reset the button text
        modelDownloadButtonEl.textContent = "Download";
        modelDownloadButtonEl.disabled = false;
        // Fetch the models from the Rust backend
        await getModels();
    }
}

async function deleteModel(modelName?: string) {
    if (modelName) {
        let res;
        try {
            res = await invoke("delete_model", {modelName});
        } catch (err) {
            alert("Error deleting model: " + err);
            return;
        }
        if (res) {
            alert(res + " deleted successfully!");
        } else {
            alert("Failed to delete " + modelName);
        }
        await getModels();
        return;
    }
}

async function showModelInfo(modelName: string): Promise<void> {
    try {
        //Get model info from shared models list
        // @ts-ignore
        const model: Model = models.find(m => m.name === modelName);
        showModelModal(model);
    } catch (err) {
        alert("Failed to fetch model info: " + err);
    }
}

async function init() {
    await invoke("init");
}

function showModelModal(model: Model): void {
    console.log("is this working?");
    let modal = document.getElementById("model-info-modal");
    if (modal) {
        let detailsEl = document.getElementById("model-info-details");
        let licenseEl = document.getElementById("model-info-license");
        let parametersEl = document.getElementById("model-info-parameters");
        let templateEl = document.getElementById("model-info-template");

        if (detailsEl) {
            // Display model name and capabilities
            let html = `<strong>${model.name}</strong><br>`;
            html += `<span style='font-size:0.95em;color:#888;'>Capabilities: ${model.capabilities?.join(", ") || "None"}</span><br><br>`;

            detailsEl.innerHTML = html;
        }
        if (licenseEl) {
            licenseEl.textContent = model.license || "No license info.";
        }
        if (parametersEl) {
            parametersEl.textContent = model.parameters || "No parameters.";
        }
        if (templateEl) {
            templateEl.textContent = model.template || "No template info.";
        }
        modal.style.display = "flex";
    }
}

function updateChatInputPlaceholderForSelectedModel() {
    if (!modelSelectEl || !streamChatInputEl) return;
    const selectedModelName = modelSelectEl.value;
    const selectedModel = models.find(m => m.name === selectedModelName);
    if (selectedModel && selectedModel.capabilities && selectedModel.capabilities.length > 0) {
        streamChatInputEl.placeholder = `Capabilities: ${selectedModel.capabilities.join(", ")}`;
    } else {
        streamChatInputEl.placeholder = "Let's chat!";
    }
}
