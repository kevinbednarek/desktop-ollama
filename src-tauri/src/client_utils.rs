use ollama_rs::Ollama;

pub async fn get_model_names(ollama: &Ollama) -> Result<Vec<String>, String> {
    let models = ollama
        .list_local_models()
        .await
        .map_err(|e| format!("Failed to list models: {:?}", e))?;

    Ok(models.into_iter().map(|model| model.name).collect())
}