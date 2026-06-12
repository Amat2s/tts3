from dataclasses import dataclass
import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from config import settings


class TriggerClientError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


@dataclass(frozen=True)
class TriggerRunHandle:
    id: str


def trigger_solver_job(payload: dict) -> TriggerRunHandle:
    secret_key = settings.trigger_secret_key
    if not secret_key:
        raise TriggerClientError("Trigger.dev secret key is not configured.")

    task_id = quote(settings.trigger_solver_task_id, safe="")
    url = f"{settings.trigger_api_url.rstrip('/')}/api/v1/tasks/{task_id}/trigger"
    body = {
        "payload": json.dumps(payload),
        "options": {
            "payloadType": "application/json",
            "idempotencyKey": str(payload["solverRunId"]),
        },
    }

    request = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = _read_error_body(exc)
        raise TriggerClientError(
            f"Trigger.dev rejected the solver job request ({exc.code}). {detail}"
        ) from exc
    except URLError as exc:
        raise TriggerClientError(
            f"Could not reach Trigger.dev: {exc.reason}"
        ) from exc
    except TimeoutError as exc:
        raise TriggerClientError("Timed out while queueing the solver job.") from exc
    except Exception as exc:
        raise TriggerClientError("Solver job could not be queued.") from exc

    run_id = data.get("id") if isinstance(data, dict) else None
    if not isinstance(run_id, str) or not run_id:
        raise TriggerClientError("Trigger.dev returned no run id for the solver job.")
    return TriggerRunHandle(id=run_id)


def _read_error_body(exc: HTTPError) -> str:
    try:
        raw = exc.read().decode("utf-8").strip()
    except Exception:
        raw = ""
    if not raw:
        return "No response detail was provided."
    return raw[:500]

