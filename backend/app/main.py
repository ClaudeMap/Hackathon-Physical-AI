from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router


app = FastAPI(
    title="Steward API",
    version="0.1.0",
    description="Shared API for the Steward frontend, Jev prioritiser and Solver.",
)

# Permit a local frontend during the hackathon. Narrow this before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)

