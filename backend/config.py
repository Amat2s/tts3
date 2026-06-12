from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str
    trigger_api_url: str = "https://api.trigger.dev"
    trigger_secret_key: str | None = None
    trigger_solver_task_id: str = "solver-job"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
