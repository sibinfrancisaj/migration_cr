# Abroad Matrimony — Backend

NX monorepo · Node.js · Express · TypeScript · Supabase (PostgreSQL) · Redis · BullMQ

## Quick start

```bash
npm install
npm run docker:up                                             # Redis on :6379
npx nx serve gateway                                         # gateway on :3000
```

`GET http://localhost:3000/api/v1/health` → `{ success: true, data: { status: "healthy" } }`

## Common commands

```bash
# Database
npx prisma db push --schema=libs/db/prisma/schema.prisma    # sync schema → Supabase
npx prisma studio --schema=libs/db/prisma/schema.prisma     # DB GUI at :5555
npx prisma generate --schema=libs/db/prisma/schema.prisma   # regenerate client

# NX tasks
npx nx test <project>           # run tests
npx nx lint <project>           # lint
npx nx typecheck <project>      # typecheck
npx nx run-many -t build        # build all
npx nx graph                    # dependency graph in browser

# Docker
npm run docker:up               # start Redis + Postgres (local fallback)
npm run docker:down             # stop
```

## Session handoff

See **CLAUDE.md** for full project context, architecture decisions, completed work,
task backlog, and the starter prompt to use when opening a new AI session.
