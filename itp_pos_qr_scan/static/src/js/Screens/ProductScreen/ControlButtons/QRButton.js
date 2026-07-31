/** @odoo-module **/

import { Component } from "@odoo/owl";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";

import { useService } from "@web/core/utils/hooks";
import { QRScanPopup } from "../../Popups/QRScanPopup";




export class QRButton extends Component {
    static template = "itp_pos_qr_scan.QRButton";

    setup() {
        super.setup();
        this.popup = useService("popup");
    }

    async onClick() {
        await this.popup.add(QRScanPopup, {});
    }
}

ProductScreen.addControlButton({
    component: QRButton,
    condition: function () {
        return true;
    },
});

