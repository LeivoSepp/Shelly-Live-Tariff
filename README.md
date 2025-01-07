# Shelly Live Tariff Script

This Shelly script is designed to retrieve energy market prices from Elering and update Shelly cloud energy price Live Tariff. 

The script executes daily after 23:00 to send Live Tariffs for the following day.

## Features

- Retrieves electricity market prices from Elering.
- Updates Shelly cloud with Live Tariffs.
- Supports multiple network packages and countries.
- Stores user settings in Shelly KVS or Virtual components.
- Automatically starts on boot.

## Installation

1. Copy the contents of `ShellyLiveTariff.js` to your Shelly device's script editor.
2. Configure the initial settings in the script:
   - `networkPacket`: Choose the appropriate network package (e.g., `VORK2`, `Partner24`, etc.).
   - `country`: Set the country code (e.g., `ee` for Estonia, `fi` for Finland, etc.).
   - `apiUrl`: Set your Shelly Cloud token.


<img src="images/EnableShellyLiveTariff.jpg" alt="Enable Shelly Live Tariff" width="750">


## Usage

- The script will automatically run daily after 23:00 to fetch and update the Live Tariffs for the following day.
- To modify user settings, access the Shelly KVS via the Shelly web page: Menu → Advanced → KVS.
- If your Shelly device supports Virtual components, you can modify settings directly from the Shelly web page or Shelly mobile app.

## Network Packages

The script supports the following network packages from [Elektrilevi](https://elektrilevi.ee/en/vorguleping/vorgupaketid/eramu) and [Imatra](https://imatraelekter.ee/vorguteenus/vorguteenuse-hinnakirjad/):

- `VORK1`
- `VORK2`
- `VORK4`
- `VORK5`
- `Partner24`
- `Partner24Plus`
- `Partner12`
- `Partner12Plus`
- `NONE`

## Supported Countries

- `ee` (Estonia)
- `fi` (Finland)
- `lv` (Latvia)
- `lt` (Lithuania)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Author

Created by Leivo Sepp, 07.01.2025

[GitHub Repository](https://github.com/LeivoSepp/Shelly-Live-Tariff)