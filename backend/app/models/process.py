"""Process workflow models."""
from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Process(Base):
    """Business process model."""

    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    steps = relationship("ProcessStep", back_populates="process", cascade="all, delete-orphan")


class ProcessStep(Base):
    """Individual step within a process."""

    __tablename__ = "process_steps"

    id = Column(Integer, primary_key=True, index=True)
    process_id = Column(Integer, ForeignKey("processes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    duration_minutes = Column(Float, nullable=False, default=0)
    cost_per_execution = Column(Float, nullable=False, default=0)
    resource_count = Column(Integer, nullable=False, default=1)
    sla_limit_minutes = Column(Float, nullable=True)
    executions_per_day = Column(Integer, nullable=False, default=1)

    process = relationship("Process", back_populates="steps")
    outgoing_dependencies = relationship(
        "Dependency",
        foreign_keys="Dependency.source_step_id",
        back_populates="source_step",
        cascade="all, delete-orphan",
    )
    incoming_dependencies = relationship(
        "Dependency",
        foreign_keys="Dependency.target_step_id",
        back_populates="target_step",
        cascade="all, delete-orphan",
    )


class Dependency(Base):
    """Dependency between process steps (forms DAG)."""

    __tablename__ = "dependencies"

    id = Column(Integer, primary_key=True, index=True)
    source_step_id = Column(
        Integer,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_step_id = Column(
        Integer,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
    )

    source_step = relationship("ProcessStep", foreign_keys=[source_step_id], back_populates="outgoing_dependencies")
    target_step = relationship("ProcessStep", foreign_keys=[target_step_id], back_populates="incoming_dependencies")
