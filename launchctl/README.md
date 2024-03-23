# MacOS LaunchAgents

The `plist` file should be put in `~/Library/LaunchAgents/` (Currently logged in user), and the binary installed at
`/usr/local/bin/demergi`.

### Creates a symlink to /usr/local/bin/
```
sudo ln -s $(which node) /usr/local/bin/
sudo ln -s $(which demergi) /usr/local/bin/
```

### Copy plist to ~/Library/LaunchAgents/
```
sudo cp -n demergi/launchctl/com.hectorm.demergi.plist ~/Library/LaunchAgents/
```

### Start the service
```
launchctl load ~/Library/LaunchAgents/com.hectorm.demergi.plist
```

### Stop the service
```
launchctl unload ~/Library/LaunchAgents/com.hectorm.demergi.plist
```

### View logs
```
sudo tail /tmp/demergi.log
```