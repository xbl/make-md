pub const KEYCHAIN_SERVICE: &str = "make-md";

pub fn provider_account(provider: &str) -> String {
    format!("ai-key:{provider}")
}

pub fn save_api_key(provider: &str, api_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &provider_account(provider))
        .map_err(|err| err.to_string())?;
    entry.set_password(api_key).map_err(|err| err.to_string())
}

pub fn load_api_key(provider: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &provider_account(provider))
        .map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(test)]
mod keychain_tests {
    use super::*;

    #[test]
    fn key_ref_round_trip_uses_provider_account_name() {
        let account = provider_account("openai");
        assert_eq!(account, "ai-key:openai");
    }
}
