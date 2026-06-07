from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
