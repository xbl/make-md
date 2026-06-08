#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderConfig {
    pub name: &'static str,
    pub base_url: &'static str,
    pub auth_header_name: &'static str,
}

impl ProviderConfig {
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "openai" => Some(Self {
                name: "openai",
                base_url: "https://api.openai.com/v1/chat/completions",
                auth_header_name: "Authorization",
            }),
            "deepseek" => Some(Self {
                name: "deepseek",
                base_url: "https://api.deepseek.com/chat/completions",
                auth_header_name: "Authorization",
            }),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_openai_defaults() {
        let provider = ProviderConfig::from_name("openai").unwrap();
        assert_eq!(provider.base_url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(provider.auth_header_name, "Authorization");
    }

    #[test]
    fn resolves_deepseek_defaults() {
        let provider = ProviderConfig::from_name("deepseek").unwrap();
        assert!(provider.base_url.contains("deepseek"));
    }
}
