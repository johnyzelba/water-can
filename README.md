# Water can server
The smart water can is a system designed to monitor and automate indoor plants care. Since adding pipelines all over your home, in order to automatically water your plants, is a bit ridicules, I have tried to come up with the second-best solution. The smart water can system is made up of three different devices.
<ul>
    <li>
        Water can filler / hub - This device is connected to a water source and can fill the water can on demand. Also act as the main hub / server which is responsible for gathering data from the routers and initiate tasks on schedule
    </li>
    <li>
        Water can router - A router which communicate with the hub over Wifi, and with the pot sensors over Bluetooth.
    </li>
    <li>
        Pot sensor - A battery powered, soil moisture (and more) sensor which uses BLE technology (Like Xiaomi mi flora)
    </li>
</ul>  

The system will monitor your plants and will fill a dedicated water can with the needed amount of water/nutrients, when it starts to dry out. A notification will be sent to the user once the process is complete.

## Features and technical info
<ul>
    <li>
        Multiple routers can be added per hub and multiple sensors per router.
    </li>
    <li>
        Specific nutrition values per plant.
    </li>
    <li>
        Telegram notifications and alerts.
    </li>
    <li>
        Water leakage detection mechanism.
    </li>
    <li>
        Water can proximity detection mechanism
    </li>
</ul>  

<br />

## Intallation

Once you've installed debian on your raspberry pi, Make sure to install node (arm version). Clone this repo to your device, install sqlite3 (<code>sudo apt install sqlite3</code>) and create a new db in the same folder as the repo:
<code>sqlite3 [path-to-repo]/WaterCan.db</code>

### Create needed tables
<code>CREATE TABLE plants (id INTEGER PRIMARY KEY AUTOINCREMENT, name STRING NOT NULL, mac STRING NOT NULL, router_mac STRING NOT NULL, pot_size INTEGER NOT NULL, n INTEGER NOT NULL, p INTEGER NOT NULL, k INTEGER NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);</code>

<code>CREATE TABLE plant_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, plant_id INTEGER SECONDARY KEY NOT NULL, soil_moisture INTEGER NOT NULL, temperture FLOAT NOT NULL, light INTEGER NOT NULL, conductivity INTEGER NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);</code>

<code>CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, plant_id INTEGER SECONDARY KEY NOT NULL, status STRING NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);</code>

<code>CREATE TABLE routers (id INTEGER PRIMARY KEY AUTOINCREMENT, name STRING NOT NULL, mac STRING NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);</code>

### Add mock data (optional)
<code>INSERT INTO plants (name, mac, router_mac, pot_size, n, p, k) VALUES ('Mock Plant 1', '5c857eb08d2e', 'B8:27:EB:B4:E7:BF', '5', 2, 2, 2);</code>

<code>INSERT INTO plants (name, mac, router_mac, pot_size, n, p, k) VALUES ('Mock Plant 2', '5c857eb08cde', 'B8:27:EB:B4:E7:BF', '3', 10, 10, 10);</code>

<code>INSERT INTO routers (name, mac) VALUES ('pi zero 1', 'B8:27:EB:B4:E7:BF');</code>

Run <code>npm i</code> in your cloned repo path.

<br />

## Running the server

In order for the server to run on startup, we will need to inStall pm2 <code>npm install pm2 -g</code>.

Then we will run <code>pm2 run start</code>, <code>pm2 startup</code>, <code>pm2 save</code> from the repo's path.
