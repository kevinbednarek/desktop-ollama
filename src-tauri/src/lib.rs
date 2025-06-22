mod client_utils;

use futures_util::StreamExt;
use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::ChatMessage;
use ollama_rs::generation::embeddings::request::{EmbeddingsInput, GenerateEmbeddingsRequest};
use ollama_rs::Ollama;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{Emitter, State};
use tokio::sync::Mutex;
use crate::client_utils::get_model_names;

#[derive(Default)]
struct AppState {
    ollama: Ollama,
    models: Vec<Model>,
    chat_history: Vec<ChatMessage>,
}

#[derive(Serialize, Debug, Clone)]
struct ChatResponse {
    message: String,
}

#[derive(Default, Debug, Clone, Serialize)]
struct Model {
    name: String,
    license: String,
    parameters: String,
    template: String,
    model_file: String,
    model_info: Map<String, Value>,
    capabilities: Vec<String>,
}

#[derive(Deserialize)]
struct ChatRequest {
    model: String,
    prompt: String
}

#[tauri::command]
async fn chat(
    request: ChatRequest,
    state: State<'_, Mutex<AppState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let mut state = state.lock().await;
    let ollama = state.ollama.clone();

    let capabilities = state
        .models
        .iter()
        .find(|m| m.name == request.model)
        .map(|m| m.capabilities.clone())
        .unwrap_or_default();

    //println!("Capabilities for model '{}': {:?}", request.model, capabilities);

    if capabilities.contains(&"embedding".to_string()) {
        let response = ollama
            .generate_embeddings(GenerateEmbeddingsRequest::new(
                request.model.clone(),
                EmbeddingsInput::Single(request.prompt.clone())))
            .await;
        match response {
            Ok(embeddings) => {
                let embedding_string: String = embeddings.embeddings.iter()
                    .map(|row| row
                        .iter()
                        .map(|&x| x.to_string())
                        .collect::<Vec<String>>()
                        .join(", "))
                    .collect::<Vec<String>>()
                    .join("\n");

                let chat_response = ChatResponse {
                    message: embedding_string,
                };
                // Emit the embeddings to the frontend
                app.emit("chat-message", chat_response)
                    .map_err(|e| e.to_string())?;
                return Ok(())
            },
            Err(e) => {
                app.emit("error", format!("Failed to generate embeddings: {:?}", e)).ok();
                return Err(format!("Failed to generate embeddings: {:?}", e));
            }
        }
    };

    //TODO: Isolate regular chat/completion logic
    let mut messages = state.chat_history.clone();
    messages.push(ChatMessage::user(request.prompt));
    let chat_request = ChatMessageRequest::new(request.model, messages.clone());

    let mut stream = ollama
        .send_chat_messages_stream(chat_request)
        .await
        .map_err(|e| format!("Failed to start chat stream: {:?}", e))?;

    let mut chat_response_text = String::new();
    while let Some(response) = stream.next().await {
        let response = response.map_err(|e| format!("Failed to get chat response: {:?}", e));
        let response = match response {
            Ok(r) => r,
            Err(e) => {
                app.emit("error", format!("Failed to get chat response: {:?}", e)).ok();
                return Err(e.to_string());
            }
        };
        let chat_response = ChatResponse {
            message: response.message.content,
        };
        // Building the response from the assistant
        chat_response_text.push_str(&chat_response.message);
        // Emitting a message to the "chat-message" listener on the frontend
        app.emit("chat-message", &chat_response)
            .map_err(|e| e.to_string())?;

        if response.done {
            // If the response is final, we can update the chat history
            messages.push(ChatMessage::assistant(chat_response_text.clone()));
            // Update the state with the new chat history
            state.chat_history = messages.clone();
        }
    }

    Ok(())
}

#[tauri::command]
async fn new_conversation(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().await;
    state.chat_history.clear();
    Ok(())
}

#[tauri::command]
async fn download_model(
    model_name: String,
    state: State<'_, Mutex<AppState>>,
    app: tauri::AppHandle
) -> Result<(), String> {
    let mut state = state.lock().await;
    let ollama = state.ollama.clone();

    let model = ollama
        .pull_model(model_name.clone(), false)
        .await;

    match model {
        Ok(_) => {
            let info = ollama
                .show_model_info(model_name.clone())
                .await
                .map_err(|e| format!("Failed to get model info for '{}': {}", model_name, e))?;

            let model = Model {
                name: model_name,
                license: info.license,
                parameters: info.parameters,
                template: info.template,
                model_file: info.modelfile,
                model_info: info.model_info,
                capabilities: info.capabilities,
            };

            state.models.push(model);

            //Update models list on the frontend
            app.emit("model-list-update", state.models.clone()).map_err(|e| e.to_string())?;

            Ok(())
        },
        Err(e) => {
            let msg = format!("Failed to download model '{}': {}", model_name, e);
            app.emit("error", msg.clone()).ok();
            Err(msg)
        }
    }
}

#[tauri::command]
async fn delete_model(
    model_name: String,
    state: State<'_, Mutex<AppState>>,
    app: tauri::AppHandle
) -> Result<(), String> {
    let mut state = state.lock().await;
    let ollama = state.ollama.clone();

    let model = ollama
        .delete_model(model_name.clone())
        .await;

    match model {
        Ok(_) => {
            state.models.retain(|m| m.name != model_name);

            //Update models list on the frontend
            app.emit("model-list-update", state.models.clone()).map_err(|e| e.to_string())?;

            Ok(())
        },
        Err(e) => {
            let msg = format!("Failed to delete model '{}': {}", model_name, e);
            app.emit("error", msg.clone()).ok();
            Err(msg)
        }
    }
}

/*#[tauri::command]
async fn show_model_info(
    model_name: String,
    state: State<'_, Mutex<AppState>>,
    app: tauri::AppHandle
) -> Result<Map<String, Value>, String> {
    let client = state.lock().await.ollama.clone();
    let info = client.show_model_info(model_name.clone()).await.map_err(|e| e.to_string());

    match info {
        Ok(info) => {
            // Return the model info as a Map<String, Value>
            Ok(info.model_info)
        },
        Err(e) => {
            let msg = format!("Failed to get model info for '{}': {}", model_name, e);
            app.emit("error", msg.clone()).ok();
            Err(msg)
        }
    }

}*/

#[tauri::command]
async fn init(
    state: State<'_, Mutex<AppState>>,
    app: tauri::AppHandle
) -> Result<(), String> {
    let mut state = state.lock().await;
    let ollama = state.ollama.clone();

    //TODO: Check if the Ollama server is running

    let model_names = get_model_names(&ollama).await?;

    for model_name in model_names {
        if !state.models.iter().any(|m| m.name == model_name) {
            let info = ollama
                .show_model_info(model_name.clone())
                .await
                .map_err(|e| format!("Failed to get model info for '{}': {}", model_name, e))?;

            let model = Model {
                name: model_name,
                license: info.license,
                parameters: info.parameters,
                template: info.template,
                model_file: info.modelfile,
                model_info: info.model_info,
                capabilities: info.capabilities,
            };

            state.models.push(model);
        }
    }
    //Update models list on the frontend
    app.emit("model-list-update", state.models.clone()).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            download_model,
            delete_model,
            chat,
            new_conversation,
            //show_model_info,
            init
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
