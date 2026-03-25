We use MongoDB Atlas as a remote database during development. 

Connecting to it is already setup, but requires configuration in the `server/.env` file.

However, there may be times (like during test week) where you can't access this MongoDB remote instance.

This guide will show you how to setup mongoDB locally.

# Setting up a local MongoDB instance

1. Make your .env file in `server/.env` if you haven't already

```
TSS_HOST=replace_with_TSS_IP
MONGODB_URL=mongodb://replacethis
```

2. In your development Docker container, install and start MongoDB

```bash
# Install MongoDB (if not already installed)
apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update && apt-get install -y mongodb-org

# Start mongod in the background
mkdir -p /data/db
mongod --fork --logpath /var/log/mongod.log
```


3. Update your .env for the local MongoDB instance
```
MONGODB_URL=mongodb://localhost:27017
```

---

This guide will become irrelevant once I figure out how to install MongoDB in the Docker container for everyone else :)

