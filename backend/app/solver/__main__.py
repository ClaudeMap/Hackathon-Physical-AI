from __future__ import annotations

import argparse
import logging
import os

from app.solver.api_client import StewardApiClient
from app.solver.config import SolverSettings
from app.solver.openai_gateway import OpenAIPlanGenerator
from app.solver.worker import SolverWorker


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Steward Solver worker")
    parser.add_argument("--once", action="store_true", help="Poll and process eligible tasks once, then exit")
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY must be set before starting the Solver worker")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = SolverSettings.from_environment()
    api = StewardApiClient(settings.api_base_url)
    worker = SolverWorker(api, OpenAIPlanGenerator(settings.model), settings)
    try:
        if args.once:
            worker.process_available_tasks()
        else:
            worker.run_forever()
    finally:
        api.close()


if __name__ == "__main__":
    main()
