"""
Setup script for installing herman backend as a package.

This allows you to use herman utilities from anywhere on your system:
    pip install -e /path/to/herman/backend

Then from any directory:
    from backend.herman_utils import audited_session
    from backend.models import Specimen, Sequence
"""

from setuptools import setup, find_packages

setup(
    name="herman-backend",
    version="1.0.0",
    description="Herman Herbarium Pro - Backend utilities and database access",
    author="Herman Development Team",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "sqlalchemy>=1.4.0",
        "mysql-connector-python>=8.0.0",
        "fastapi>=0.100.0",
        "python-dotenv>=0.19.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": [
            "pytest",
            "black",
            "flake8",
        ]
    },
    entry_points={
        "console_scripts": [
            "herman-utils=herman_utils:main",
        ]
    },
)
