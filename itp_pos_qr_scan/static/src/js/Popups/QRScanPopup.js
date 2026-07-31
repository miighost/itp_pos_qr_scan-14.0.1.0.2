/** @odoo-module **/

import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class QRScanPopup extends AbstractAwaitablePopup {
    static template = "itp_pos_qr_scan.QRScanPopup";

    setup() {
        super.setup();
        this.popup = useService("popup");
        this.pos = useService("pos");

        this.state = useState({
            loading: true,
            active_camera: null,
            videoDevices: [],
        });

        this.videoElement = useRef("preview");
        this.canvas = useRef("canvas");
        this.captureTimeout = 700;
        this.stream = null;
        this.gCtx = null;

        onMounted(() => {
            this.onMounted();
        });

        onWillUnmount(() => {
            this.stopCamera();
        });
    }

    get isBrowserSupported() {
        return Boolean(
            navigator.mediaDevices &&
            navigator.mediaDevices.enumerateDevices &&
            navigator.mediaDevices.getUserMedia
        );
    }

    stopCamera() {
        this.state.active_camera = false;
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }
    }

    async onClickCancel() {
        this.stopCamera();
        await this.cancel();
    }

    async onClickCameraButton(deviceId) {
        this.startWebCam(deviceId);
        if (this.pos && this.pos.db) {
            this.pos.db.save("active_camera_id", deviceId);
        }
    }

    async onMounted() {
        if (!this.isBrowserSupported) return;
        this.state.loading = true;

        try {
            await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const video_devices = devices.filter((d) => d.kind === "videoinput");

            if (video_devices.some((device) => !device.deviceId)) {
                this.popup.add("ErrorPopup", {
                    body: "Browser returns empty device IDs. Perhaps you need to use HTTPS connection?",
                });
                return;
            }

            this.state.videoDevices = video_devices;
            let deviceId = video_devices.length ? video_devices[0].deviceId : false;
            let facingMode = false;

            for (const device of video_devices) {
                if (device.label && device.label.toLowerCase().includes("back")) {
                    deviceId = device.deviceId;
                    facingMode = "environment";
                }
            }

            const active_camera_id = this.pos && this.pos.db ? this.pos.db.load("active_camera_id", false) : false;
            if (active_camera_id && video_devices.some((d) => d.deviceId === active_camera_id)) {
                deviceId = active_camera_id;
                facingMode = false;
            }

            this.state.loading = false;
            if (deviceId) {
                this.startWebCam(deviceId, facingMode);
            }
        } catch (error) {
            console.error(error);
            this.state.loading = false;
            this.popup.add("ErrorPopup", {
                body: error.message || String(error),
            });
        }
    }

    read(result) {
        if (this.pos && this.pos.debug) {
            console.log("QR scanned", result);
        }
        if (this.env.bus) {
            this.env.bus.trigger("qr_scanned", result);
        }
        this.onClickCancel();
    }

    startWebCam(deviceId, facingMode) {
        const options = { deviceId: { exact: deviceId } };
        if (facingMode) {
            options.facingMode = facingMode;
        }
        this.state.loading = false;
        this.state.active_camera = deviceId;
        this.initCanvas(800, 600);

        if (typeof window.qrcode !== "undefined") {
            window.qrcode.callback = (value) => this.read(value);
        }

        navigator.mediaDevices
            .getUserMedia({ video: options, audio: false })
            .then((stream) => {
                this.stream = stream;
                this.success(stream);
            })
            .catch((error) => {
                this.popup.add("ErrorPopup", {
                    title: (error.name || "") + " " + (error.code || ""),
                    body: error.message || String(error),
                });
            });

        setTimeout(() => this.captureToCanvas(), this.captureTimeout);
    }

    success(stream) {
        if (this.videoElement && this.videoElement.el) {
            this.videoElement.el.srcObject = stream;
            this.videoElement.el.play();
        }
    }

    captureToCanvas() {
        if (!this.state.active_camera) return;

        try {
            if (this.gCtx && this.videoElement && this.videoElement.el) {
                this.gCtx.drawImage(this.videoElement.el, 0, 0);
                if (typeof window.qrcode !== "undefined") {
                    window.qrcode.decode();
                }
            }
        } catch (e) {
            console.log(e);
        }
        if (this.state.active_camera) {
            setTimeout(() => this.captureToCanvas(), this.captureTimeout);
        }
    }

    initCanvas(w, h) {
        if (!this.canvas || !this.canvas.el) return;
        const gCanvas = this.canvas.el;
        gCanvas.style.width = w + "px";
        gCanvas.style.height = h + "px";
        gCanvas.width = w;
        gCanvas.height = h;
        const gCtx = gCanvas.getContext("2d");
        gCtx.clearRect(0, 0, w, h);
        this.gCtx = gCtx;
    }
}

