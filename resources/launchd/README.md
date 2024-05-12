# macOS Launch Agent

Install [Node.js](https://nodejs.org/en/download/), install Demergi in `/usr/local/bin/demergi` and place the `plist` file in `~/Library/LaunchAgents/`.

> [!NOTE]
> This service is provided on a best efforts basis as I am not a macOS user.

## Start the service

```sh
launchctl load ~/Library/LaunchAgents/com.hectorm.demergi.plist
```

## Stop the service

```sh
launchctl unload ~/Library/LaunchAgents/com.hectorm.demergi.plist
```

## View logs

```sh
tail -100f /tmp/demergi.log
```
