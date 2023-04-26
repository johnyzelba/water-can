# Water can server

## Init DB

### Create needed tables
CREATE TABLE plants (id INTEGER PRIMARY KEY AUTOINCREMENT, name STRING NOT NULL, mac STRING NOT NULL, router_mac STRING NOT NULL, pot_size INTEGER NOT NULL, n INTEGER NOT NULL, p INTEGER NOT NULL, k INTEGER NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);<br />
CREATE TABLE plant_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, plant_id INTEGER SECONDARY KEY NOT NULL, soil_moisture INTEGER NOT NULL, temperture FLOAT NOT NULL, light INTEGER NOT NULL, conductivity INTEGER NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);<br />
CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, plant_id INTEGER SECONDARY KEY NOT NULL, status STRING NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);<br />
CREATE TABLE routers (id INTEGER PRIMARY KEY AUTOINCREMENT, name STRING NOT NULL, mac STRING NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);<br />
<br /><br />
### Add mock data (for testing)
INSERT INTO plants (name, mac, router_mac, pot_size, n, p, k) VALUES ('Mock Plant 1', '', 'B8:27:EB:B4:E7:BF', '5', 2, 2, 2);<br />
INSERT INTO plants (name, mac, router_mac, pot_size, n, p, k) VALUES ('Mock Plant 2', '', 'B8:27:EB:B4:E7:BF', '3', 10, 10, 10);<br />
INSERT INTO plants (name, mac, router_mac, pot_size, n, p, k) VALUES ('Mock Plant 3', '', 'B8:27:EB:B4:E7:BF', '5', 5, 8, 7);<br />
INSERT INTO routers (name, mac) VALUES ('pi zero 1', 'B8:27:EB:B4:E7:BF');<br />