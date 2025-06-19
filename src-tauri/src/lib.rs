// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::any::{Any, TypeId};
use futures_util::StreamExt;
use ollama_rs::generation::chat::request::ChatMessageRequest;
use ollama_rs::generation::chat::ChatMessage;
use ollama_rs::Ollama;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use tokio::sync::Mutex;

#[derive(Default)]
struct AppState {
    ollama: Ollama,
    model: String,
    chat_history: Vec<ChatMessage>,
}

#[derive(Serialize, Debug, Clone)]
struct ChatResponse {
    message: String,
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

    let client = state.ollama.clone();
    let mut messages = state.chat_history.clone();
    messages.push(ChatMessage::user(request.prompt));
    let chat_request = ChatMessageRequest::new(request.model, messages.clone());

    let mut stream = client
        .send_chat_messages_stream(chat_request)
        .await
        .map_err(|e| format!("Failed to start chat stream: {:?}", e))?;

    let mut chat_response_text = String::new();
    while let Some(response) = stream.next().await {
        let response = response.map_err(|e| format!("Failed to get chat response: {:?}", e))?;
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
async fn get_models(state: State<'_, Mutex<AppState>>) -> Result<Vec<String>, String> {
    let models = {
        let client = state.lock().await.ollama.clone();
        client
            .list_local_models()
            .await
            .map_err(|e| format!("Failed to list models: {:?}", e))?
    };
    Ok(models.iter().map(|m| m.name.clone()).collect())
}

#[tauri::command]
async fn download_model(model_name: String) -> Result<String, String> {
    // Execute the "ollama pull" command to download the model
    let output = std::process::Command::new("ollama")
        .arg("pull")
        .arg(&model_name)
        .output()
        .map_err(|e| format!("Failed to execute 'ollama pull': {:?}", e))?;

    if output.status.success() {
        // If the command was successful, return the output as a string
        Ok(model_name)
    } else {
        // If the command failed, return the error message
        Err(model_name)
    }
}

#[tauri::command]
async fn delete_model(model_name: String) -> Result<String, String> {
    // Execute the "ollama delete" command to delete the model
    let output = std::process::Command::new("ollama")
        .arg("rm")
        .arg(&model_name)
        .output()
        .map_err(|e| format!("Failed to execute 'ollama delete': {:?}", e))?;

    if output.status.success() {
        // If the command was successful, return a success message
        Ok(format!("Model '{}' deleted successfully!", model_name))
    } else {
        // If the command failed, return the error message
        Err(format!(
            "Failed to delete model '{}': {}",
            model_name,
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
async fn show_model_info(model_name: String, state: State<'_, Mutex<AppState>>) -> Result<serde_json::map::Map<String, serde_json::value::Value>, String> {
    let client = state.lock().await.ollama.clone();
    let info = client.show_model_info(model_name).await.map_err(|e| e.to_string())?;

    Ok(info.model_info)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            download_model,
            delete_model,
            get_models,
            chat,
            new_conversation,
            show_model_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
