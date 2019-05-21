# ⚙️ Jobs Workers - [jobs.chile.sh](https://jobs.chile.sh)

Bots used for scraping data.

Supported sites:

- [getonbrd](https://www.getonbrd.com/): Get jobs salaries in USD and CLP.

For an easier development, use [this docker-compose config](https://github.com/chile-sh/docker-common), since it comes with Postgres, RabbitMQ, and Redis, with the default environment variables used on the example env file, and the same network config.

## Pre-requisites

- Node 11+
- Yarn
- Docker (with docker-compose)

## Clone & Install

```bash
git clone git@github.com:chile-sh/jobs-workers.git

cd jobs-worker && yarn
```

## Config

```bash
# Modify with your own env vars
cp .env.example .env

# Don't forget to set a default getonbrd session
# You can extract the token from the _getonboard_session cookie on your browser
GETONBRD_SESSION=...
```

> **Note**: If you want to run TypeScript outside docker, set `RMQ_HOST` and `PG_HOST` to `localhost`

## Run

```bash
yarn dev
```

## Test

```bash
yarn test
```

# License

GNU General Public License v3.0

