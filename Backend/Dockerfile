# Use the official Python 3.12 image
FROM python:3.12-slim

# Hugging Face Spaces require running as a non-root user
RUN useradd -m -u 1000 user

# Set the working directory (This initially creates /app as 'root')
WORKDIR /app

# ---> NEW FIX: Give the non-root user ownership of the /app folder
RUN chown -R user:user /app

# Ensure the user's local bin is in the PATH
ENV PATH="/home/user/.local/bin:$PATH"

# Copy the requirements file and set ownership to the new user
COPY --chown=user:user requirements.txt requirements.txt

# Switch to the non-root user
USER user

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend files into the container
COPY --chown=user:user . .

# Hugging Face expects the app to listen on port 7860
EXPOSE 7860

# Start the FastAPI server on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]