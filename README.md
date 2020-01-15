# bath-control

## raspi setup

### installations

```sh
sudo apt-get update
sudo apt-get install vim
sudo apt-get install git
sudo apt-get install build-essential
sudo apt-get install unzip
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash
```

### samba

```sh
sudo smbpasswd -a <user_name>
```

/etc/samba/smb.conf

```
[shared]
path = /home/pirate/shared
available = yes
valid users = <user_name>
read only = no
browsable = yes
public = yes
writable = yes
```

```sh
sudo service smbd restart
```

### pigpio

```sh
wget abyz.me.uk/rpi/pigpio/pigpio.zip
unzip pigpio.zip
cd PIGPIO
make
sudo make install
```

### docker

#### dns

/etc/docker/daemon.json

```json
{
    "dns": ["10.0.0.2", "8.8.8.8"]
}
```