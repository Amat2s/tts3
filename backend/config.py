from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str
    trigger_api_url: str = "https://api.trigger.dev"
    trigger_secret_key: str | None = None
    trigger_solver_task_id: str = "solver-job"

    # Shared secret authorizing the Trigger.dev solver worker to invoke the
    # internal solver execution endpoint (Unit 56). It is a server-to-server
    # credential: the deployed worker presents it as a Bearer token. When unset
    # the internal endpoint fails closed (503) so it is never left open.
    solver_internal_token: str | None = None

    # Observability (Unit 49). Sentry is enabled only when a DSN is provided;
    # the backend runs normally when it is absent. ``environment`` tags captured
    # events and logs so failures are attributable to a deployment context.
    sentry_dsn: str | None = None
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
