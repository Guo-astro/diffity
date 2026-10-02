use std::path::{Path, PathBuf};

const PLACEHOLDER_MARKER: &str = "diffity sidecar placeholder";

/// (binary, feature) for each `externalBin` sidecar.
const SIDECARS: [(&str, &str); 2] = [("diffity-mcp", "mcp"), ("diffity-cli", "cli")];

/// `tauri-build` requires each `externalBin` sidecar (`binaries/<name>-<triple>`) to exist.
/// `scripts/prepare-mcp.mjs` (run by `beforeDevCommand`/`beforeBuildCommand`) produces them; for plain
/// `cargo build`/`cargo test` we reuse an already built binary or write a placeholder script.
fn ensure_sidecar(name: &str, feature: &str) {
    let triple = std::env::var("TARGET").unwrap_or_default();
    let ext = if triple.contains("windows") { ".exe" } else { "" };
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let sidecar = manifest
        .join("binaries")
        .join(format!("{name}-{triple}{ext}"));
    if sidecar.exists() && !is_placeholder(&sidecar) {
        return;
    }
    let _ = std::fs::create_dir_all(sidecar.parent().unwrap_or(Path::new(".")));
    let built = profile_dir().map(|d| d.join(format!("{name}{ext}")));
    if let Some(built) = built.filter(|p| p.exists() && !is_placeholder(p)) {
        if std::fs::copy(&built, &sidecar).is_ok() {
            return;
        }
    }
    if sidecar.exists() {
        return;
    }
    let script = format!(
        "#!/bin/sh\n# {PLACEHOLDER_MARKER}\necho '{name} was not built; run `cargo build --features {feature} --bin {name}`' >&2\nexit 1\n"
    );
    let _ = std::fs::write(&sidecar, script);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&sidecar, std::fs::Permissions::from_mode(0o755));
    }
}

fn profile_dir() -> Option<PathBuf> {
    let out = PathBuf::from(std::env::var("OUT_DIR").ok()?);
    out.ancestors().nth(3).map(Path::to_path_buf)
}

fn is_placeholder(path: &Path) -> bool {
    let Ok(meta) = std::fs::metadata(path) else {
        return false;
    };
    if meta.len() > 4096 {
        return false;
    }
    std::fs::read_to_string(path).is_ok_and(|s| s.contains(PLACEHOLDER_MARKER))
}

fn main() {
    // The sidecar-only build (`--no-default-features --features mcp,cli`, see scripts/prepare-mcp.mjs) has no Tauri app.
    if std::env::var_os("CARGO_FEATURE_APP").is_none() {
        return;
    }
    for (name, feature) in SIDECARS {
        ensure_sidecar(name, feature);
    }
    #[cfg(feature = "app")]
    tauri_build::build()
}
