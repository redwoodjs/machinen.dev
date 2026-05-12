# live-mount

Boot a VM with `./shared/` FUSE-mounted into the guest at
`/mnt/shared` — host edits show up in the guest immediately, guest
writes show up on the host.

## Run

```sh
pnpm install
pnpm start
```

From another terminal:

```sh
curl http://localhost:8080/        # current message
echo "edited" > ./shared/message.txt
curl http://localhost:8080/        # the guest re-reads it
tail -f ./shared/access.log        # guest writes land here
```

The guest runs `/mnt/shared/server.mjs` as its default cmd, so edits
to `shared/server.mjs` apply on the next boot without re-baking.
