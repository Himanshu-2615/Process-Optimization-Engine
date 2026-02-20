"""Process-related Pydantic schemas."""
from pydantic import BaseModel, ConfigDict, Field


class ProcessStepBase(BaseModel):
    """Base schema for process step."""

    name: str
    duration_minutes: float = Field(ge=0)
    cost_per_execution: float = Field(ge=0)
    resource_count: int = Field(ge=1)
    sla_limit_minutes: float | None = None
    executions_per_day: int = Field(ge=1)


class ProcessStepCreate(ProcessStepBase):
    """Schema for creating a process step."""
    pass


class StepAddRequest(ProcessStepBase):
    """Schema for adding a step to an existing process."""
    link_from_last: bool = True  # auto-create dependency from last step


class ProcessStepUpdate(BaseModel):
    """Schema for updating a process step (all optional)."""

    name: str | None = None
    duration_minutes: float | None = Field(None, ge=0)
    cost_per_execution: float | None = Field(None, ge=0)
    resource_count: int | None = Field(None, ge=1)
    sla_limit_minutes: float | None = None
    executions_per_day: int | None = Field(None, ge=1)


class ProcessUpdate(BaseModel):
    """Schema for updating a process."""

    name: str | None = None
    description: str | None = None


class ProcessStepResponse(ProcessStepBase):
    """Schema for process step response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    process_id: int


class DependencyBase(BaseModel):
    """Base schema for dependency."""

    source_step_id: int
    target_step_id: int


class DependencyCreate(DependencyBase):
    """Schema for creating a dependency."""
    pass


class DependencyResponse(DependencyBase):
    """Schema for dependency response."""

    model_config = ConfigDict(from_attributes=True)

    id: int


class ProcessBase(BaseModel):
    """Base schema for process."""

    name: str
    description: str | None = None


class ProcessCreate(ProcessBase):
    """Schema for creating a process with steps and dependencies."""

    steps: list[ProcessStepCreate]
    dependencies: list[DependencyCreate] = []


class ProcessResponse(ProcessBase):
    """Schema for process response."""

    model_config = ConfigDict(from_attributes=True)

    id: int


class ProcessFullResponse(ProcessResponse):
    """Full process with steps and dependencies."""

    steps: list[ProcessStepResponse]
    dependencies: list[DependencyResponse]
