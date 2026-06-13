from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str
    trigger_api_url: str = "https://api.trigger.dev"
    trigger_secret_key: str | None = None
    trigger_solver_task_id: str = "solver-job"

    # Observability (Unit 49). Sentry is enabled only when a DSN is provided;
    # the backend runs normally when it is absent. ``environment`` tags captured
    # events and logs so failures are attributable to a deployment context.
    sentry_dsn: str | None = None
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
