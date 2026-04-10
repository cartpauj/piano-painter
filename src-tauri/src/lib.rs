use std::fs;
use tauri::Manager;

#[tauri::command]
fn save_project(path: String, data: String) -> Result<(), String> {
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_project(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_mp3(path: String, pcm_base64: String, sample_rate: u32) -> Result<(), String> {
    use std::mem::MaybeUninit;
    use mp3lame_encoder::{Builder, FlushNoGap, DualPcm};
    use base64::Engine;

    // Decode base64 to bytes, then reinterpret as i16 samples
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&pcm_base64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let pcm_i16: Vec<i16> = bytes
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    let mut mp3_encoder = Builder::new().ok_or("Failed to create MP3 encoder")?;
    mp3_encoder.set_num_channels(2).map_err(|e| format!("{:?}", e))?;
    mp3_encoder.set_sample_rate(sample_rate).map_err(|e| format!("{:?}", e))?;
    mp3_encoder.set_brate(mp3lame_encoder::Birtate::Kbps192).map_err(|e| format!("{:?}", e))?;
    mp3_encoder.set_quality(mp3lame_encoder::Quality::Best).map_err(|e| format!("{:?}", e))?;

    let mut encoder = mp3_encoder.build().map_err(|e| format!("{:?}", e))?;

    let input = DualPcm { left: &pcm_i16, right: &pcm_i16 };

    // Allocate output buffer (worst case: input size * 1.25 + 7200)
    let max_out_size = (pcm_i16.len() as f64 * 1.25) as usize + 7200;
    let mut mp3_buf: Vec<MaybeUninit<u8>> = vec![MaybeUninit::uninit(); max_out_size];
    let mut mp3_out = Vec::new();

    let encoded_size = encoder.encode(input, &mut mp3_buf).map_err(|e| format!("{:?}", e))?;
    for i in 0..encoded_size {
        mp3_out.push(unsafe { mp3_buf[i].assume_init() });
    }

    let mut flush_buf: Vec<MaybeUninit<u8>> = vec![MaybeUninit::uninit(); 7200];
    let flushed_size = encoder.flush::<FlushNoGap>(&mut flush_buf).map_err(|e| format!("{:?}", e))?;
    for i in 0..flushed_size {
        mp3_out.push(unsafe { flush_buf[i].assume_init() });
    }

    fs::write(&path, &mp3_out).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_sample(app: tauri::AppHandle, key: String, pcm_base64: String) -> Result<(), String> {
    use base64::Engine;

    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let samples_dir = dir.join("samples");
    fs::create_dir_all(&samples_dir).map_err(|e| e.to_string())?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&pcm_base64)
        .map_err(|e| format!("Base64 decode: {}", e))?;

    // Use base64url of key as filename to avoid special chars
    let file_name = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(key.as_bytes());
    fs::write(samples_dir.join(format!("{}.pcm", file_name)), &bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_sample(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    use base64::Engine;

    let file_name = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(key.as_bytes());
    let pcm_file = format!("{}.pcm", file_name);

    // Check bundled resources first
    let resource_path = app.path().resource_dir().map_err(|e| e.to_string())?
        .join("resources").join("samples").join(&pcm_file);
    if resource_path.exists() {
        let bytes = fs::read(&resource_path).map_err(|e| e.to_string())?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        return Ok(Some(b64));
    }

    // Fall back to app data cache
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("samples").join(&pcm_file);

    if !path.exists() {
        return Ok(None);
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(Some(b64))
}

#[tauri::command]
fn list_cached_samples(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use base64::Engine;

    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let samples_dir = dir.join("samples");

    if !samples_dir.exists() {
        return Ok(vec![]);
    }

    let mut keys = vec![];
    for entry in fs::read_dir(&samples_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(encoded) = name.strip_suffix(".pcm") {
            if let Ok(key_bytes) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(encoded) {
                if let Ok(key) = String::from_utf8(key_bytes) {
                    keys.push(key);
                }
            }
        }
    }

    Ok(keys)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_project, load_project, export_mp3, save_sample, load_sample, list_cached_samples])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
