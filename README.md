# Shelly Live Tariff Script

> [!TIP]
> This feature allows you to view the exact cost of your electricity usage in Shelly Cloud using Live Tariff if you have any [Shelly power monitoring](https://www.shelly.com/collections/energy-metering) device installed.

- [Shelly Live Tariff Script](#shelly-live-tariff-script)
  - [Features](#features)
  - [Installation](#installation)
    - [New installation](#new-installation)
    - [Configuration using Virtual Components](#configuration-using-virtual-components)
    - [How to force script to KVS mode](#how-to-force-script-to-kvs-mode)
    - [Configuration using KVS](#configuration-using-kvs)
    - [Shelly Live Tariff Configuration](#shelly-live-tariff-configuration)
    - [Updating the Script](#updating-the-script)
  - [Usage](#usage)
    - [Device configuration](#device-configuration)
    - [Cost monitoring](#cost-monitoring)
    - [Script Monitoring](#script-monitoring)
  - [License](#license)
  - [Author](#author)


<img src="images/TotalEnergyUsage.jpg" alt="Shelly Live Tariff" width="500">

## Features

This Shelly script automates electricity tariffs in the Shelly cloud by retrieving energy market prices from Elering and updating the Live Tariff hourly.

- Retrieves electricity market prices from Elering.
- Updates Shelly cloud with Live Tariffs hourly or every 15min.
- Supports multiple network packages and countries.
- Stores user settings in Shelly KVS or Virtual components (gen2 Pro or never devices).
- Automatically starts on boot.

## Installation

### New installation

1. Copy the contents of `ShellyLiveTariff.js` to your Shelly device's script editor.
2. Run the script to create KVS or Virtual Components.
3. Configure script settings either in KVS or using Virtual Components.
   - `networkPacket`: Set the energy transmission packet (`VORK2`, `Partner24` etc).
   - `IsEnergy15min` / `Meter supports`: 1h or 15min electricity meter. Default value 1h (`false`), set it 15min or `true` only if your meter supports it.
   - `country`: Set the country (`ee` for Estonia, `fi` for Finland etc).
   - `apiUrl`: Shelly Cloud token.
4. Run the script again. Now everything is fully automatic.

### Configuration using Virtual Components

Shelly Gen2 Pro and never devices supports **Virtual Components**, with all settings managed directly through the Shelly web page or mobile app.  
Please make sure to configure properly Shelly API URL and Network Package, as well as country.

> [!NOTE]
> The script will always update the field **Live Tariff Updated** with the date and time when new tariff was uploaded to Shelly Cloud.

<img src="images/ShellyVirtualCompLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="300">

### How to force script to KVS mode

> [!TIP]
> This script can be forced to KVS mode even if Virtal Components are available.  

You want to have this in KVS mode in case you have other important scripts already using Virtual Components in the same device.  
Open the script and set the ManualKVS parameter ``mnKv: true``. Now the script will install in KVS mode.

```js
let c = {
    pack: "VORK2",     // NONE, VORK1, VORK2, VORK4, VORK5, PARTN24, PARTN24PL, PARTN12, PARTN12PL, PAMATA1, SPECIAL1
    is15: false,       // 1h or 15min measurements
    cnty: "ee",        // Estonia-ee, Finland-fi, Lithuania-lt, Latvia-lv
    api: "API_url",    // Shelly Cloud token
    mnKv: false,       // Forcing KVS mode in case of Virtual components support
}
```

### Configuration using KVS

> [!IMPORTANT]
> There is a bug in Shelly firmware version 1.7.1 that prevents saving JSON data to KVS. You can view the data, but you cannot modify or save it.
> 
> Therefore, when using KVS mode, the script parameters (such as network package, API URL, etc.) must be defined directly within the script itself before installation.

If the script in **KVS mode**, then settings can be modified via the device's web page using its IP address: Menu → Advanced → KVS.  
All the user settings are stored in JSON format under the key ``LiveTariffConf``.
   - `API`: Set your Shelly Cloud token.
   - `IsEnergy15min`: 1h or 15min electricity meter. Default value 1h (`false`), set it 15min or `true` only if your meter supports it.
   - `EnergyProvider`: Choose the appropriate network package (e.g., `VORK2`, `PARTN24`, etc.).
   - `Country`: Set the country code (e.g., `ee` for Estonia, `fi` for Finland, etc.).

<img src="images/KvsLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="400">

**Supported Network Packages**

The script supports the following network packages from [Elektrilevi](https://elektrilevi.ee/en/vorguleping/vorgupaketid/eramu) and [Imatra](https://imatraelekter.ee/vorguteenus/vorguteenuse-hinnakirjad/):

- `VORK1`
- `VORK2`
- `VORK4`
- `VORK5`
- `PARTN24`
- `PARTN24P`
- `PARTN12`
- `PARTN12P`
- `PAMATA1`
- `SPECIAL1`
- `NONE`

**Supported Countries**

- `ee` (Estonia)
- `fi` (Finland)
- `lv` (Latvia)
- `lt` (Lithuania)

### Shelly Live Tariff Configuration

Configure Shelly cloud to use Live Tariff
1. Open Shelly web portal 
2. Select Energy -> Electricity Tariff
3. Under Tariff select Live
4. Copy API URL and paste it to Live Tariff settings.

<img src="images/EnableShellyLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="650">

### Updating the Script

To update the script, simply copy the new code into the Shelly code editor — everything will continue to work automatically, since the configuration is stored in Virtual Components or in the KVS storage.

> [!IMPORTANT]
> With the addition of 15-minute electricity meter support, a new virtual component has been introduced, which is created only during a fresh script installation.
> Follow these steps:
> - Delete the LiveTariffConf entry from the KVS storage.
> - Run the script — this will trigger a new LiveTariff installation.
> - Reconfigure the API URL and other necessary parameters.

## Usage

### Device configuration

There are various ways to configure Shelly devices to ensure the Shelly Cloud energy measurement and cost reports appears accurate and well-organized.

1. Shelly Pro 3EM + Individual Shelly Power Monitoring Devices in the Same Room. <br>
To avoid double-counting energy costs at the room or total account level, devices must be configured properly:
   - Configure Shelly Pro 3EM to include power monitoring in both the room and total account levels.
   - Configure other Shelly monitoring devices in the same room to exclude their data from the total room and total account energy.

|||
|-|-|
|<img src="images/Configure3EM.jpg" alt="Shelly Live Tariff" width="200">|<img src="images/ConfigureDevice.jpg" alt="Shelly Live Tariff" width="200">|

1. Shelly Pro 3 EM at Account level + Individual Shelly Power Monitoring Devices in the Different Rooms. <br>
To avoid missing energy costs at the room or double-counting at the total account level, devices must be configured properly:
   - Configure Shelly Pro 3EM to include power monitoring in total account level.
   - Configure other Shelly monitoring devices to include their data fom the total room and exclude from total account energy.

|||
|-|-|
|<img src="images/Configure3EM.jpg" alt="Shelly Live Tariff" width="200">|<img src="images/ConfigureDeviceRoom.jpg" alt="Shelly Live Tariff" width="200">|

3. Individual Shelly Power Monitoring Devices in the Different Rooms. Account level measurement is missing. <br>
To avoid missing energy costs at the total account level, devices must be configured properly:
   - Configure every Shelly monitoring devices to include power monitoring in both the room and total account levels.
  
### Cost monitoring

There are many ways to explore the electricity usage cost. 

1. **Total Cost.** Open the Shelly Cloud [Total Energy history](https://control.shelly.cloud/#/cons/0) to explore the total cost across your entire energy usage.  
<img src="images/TotalEnergyUsage.jpg" alt="Shelly Live Tariff" width="500">

2. **Room Cost.** Open the Shelly Cloud [Total Energy history](https://control.shelly.cloud/#/cons/0) and scroll down to explore the energy cost for any individual room.  
<img src="images/RoomUsage.jpg" alt="Shelly Live Tariff" width="500">

3. **Phase Cost.** This feature is available only if you have a Shelly Pro 3EM. Open the Shelly device consumption page and hover over the graph with your mouse or finger to explore the individual phase and total energy costs passing through the device.   
<img src="images/3EMUsage.jpg" alt="Shelly Live Tariff" width="500">

4. **Device Cost.** Open the consumption page of any power monitoring Shelly device to explore the cost at the device level.   
<img src="images/EnergyUsageCost.jpg" alt="Enable Shelly Live Tariff" width="300">

### Script Monitoring 
- The Virtual Component ``Live Tariff updated`` is updated whenever the tariff is sent to the Shelly Live Tariff cloud.
- Fields ``LastCalculation`` and ``TariffUpdated`` under the ``LiveTariffSys`` in KVS is updated whenever electricity prices are pulled from Elering and the tariff is sent to the Shelly Live Tariff cloud.
- The script will automatically run and update the Shelly Cloud Live Tariffs on an hourly basis.
- To modify user settings, access the Shelly KVS via the Shelly web page: Menu → Advanced → KVS.
- If your Shelly device supports Virtual components, you can modify settings directly from the Shelly web page or Shelly mobile app.

<img src="images/LastUpdated.jpg" alt="Last Updated data in KVS" width="400">

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author

Created by Leivo Sepp, 07.01.2025

[Shelly Live Tariff - GitHub Repository](https://github.com/LeivoSepp/Shelly-Live-Tariff)