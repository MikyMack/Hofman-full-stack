const axios = require('axios');
const BASE_URL = process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in';

let token = null;

async function authenticate() {
    const res = await axios.post(`${BASE_URL}/v1/external/auth/login`, {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
    });
    token = res.data.token;
    return token;
}

async function getToken() {
    if (!token) {
        token = await authenticate();
    }
    return token;
}

function calculateOrderWeight(items) {
    if (!items || items.length === 0) return 1;
    return items.reduce((total, item) => total + (item.weight || 0.2), 0);
}

async function createOrder(order, shippingAddress) {
    try {
        const authToken = await getToken();
        
        if (!order || !shippingAddress) {
            throw new Error('Order or shipping address data missing');
        }

        const nameParts = shippingAddress.name ? shippingAddress.name.trim().split(/\s+/) : [];
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        const payload = {
            order_id: order._id.toString(),
            order_date: new Date(order.createdAt).toISOString().split('T')[0],
            pickup_location: 'warehouse',
            billing_customer_name: firstName,
            billing_last_name: lastName,
            billing_address: shippingAddress.addressLine1 || '',
            billing_address_2: shippingAddress.addressLine2 || '',
            billing_city: shippingAddress.city || '',
            billing_pincode: shippingAddress.pincode || '',
            billing_state: shippingAddress.state || '',
            billing_country: 'India',
            billing_email: shippingAddress.email || 'hofmaanstore@gmail.com',
            billing_phone: shippingAddress.phone || '',
            shipping_is_billing: true,
            order_items: order.items.map(item => ({
                name: item.name || 'Product',
                sku: item.product?.toString() || `SKU-${item._id.toString().slice(-6)}`,
                units: item.quantity || 1,
                selling_price: item.price || 0,
                discount: item.discount || 0,
                tax: item.tax || 0,
                hsn: item.hsn || 123
            })),
            payment_method: 'Prepaid',
            sub_total: order.totalAmount || 0,
            length: 10,
            breadth: 10,
            height: 10,
            weight: calculateOrderWeight(order.items)
        };

        if (shippingAddress.companyName) {
            payload.billing_company_name = shippingAddress.companyName;
        }

        const response = await axios.post(
            `${BASE_URL}/v1/external/orders/create/adhoc`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        if (!response.data?.shipment_id) {
            console.error('Shiprocket API response:', response.data);
            throw new Error('Shiprocket did not return shipment_id');
        }

        return {
            ...response.data,
            shipment_id: response.data.shipment_id,
            order_id: response.data.order_id || order._id.toString()
        };
    } catch (error) {
        console.error('Shiprocket createOrder error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

async function assignAWB(shipmentId, shippingAddress, orderItems) {
    if (!shippingAddress || !shippingAddress.pincode) {
        throw new Error('Shipping address or pincode missing for AWB assignment');
    }

    const authToken = await getToken();

    const recommended = await axios.get(
        `${BASE_URL}/v1/external/courier/serviceability/`,
        {
            params: {
                pickup_postcode: process.env.PICKUP_PINCODE,
                delivery_postcode: shippingAddress.pincode,
                weight: calculateOrderWeight(orderItems),
                cod: 0
            },
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        }
    );

    const recommendedCourier = recommended.data?.data?.available_courier_companies?.[0];
    if (!recommendedCourier) {
        throw new Error('No serviceable courier found for this shipment');
    }

    const response = await axios.post(
        `${BASE_URL}/v1/external/courier/assign/awb`,
        {
            shipment_id: [shipmentId],
            courier_id: recommendedCourier.courier_company_id
        },
        {
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        }
    );

    if (response.data?.awb_assign_status !== 1) {
        throw new Error('AWB assignment failed: ' + JSON.stringify(response.data));
    }
    
    return response.data.response.data;
}

async function generatePickup(shipmentId) {
    try {
        const authToken = await getToken();
        const response = await axios.post(
            `${BASE_URL}/v1/external/courier/generate/pickup`,
            { shipment_id: [shipmentId] },
            {
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Pickup generation error:', error.response?.data || error.message);
        throw error;
    }
}

async function verifyShipment(shipmentId, authToken) {
    const endpoints = [
        `/v1/external/shipments/${shipmentId}`,
        `/v1/external/courier/awb/${shipmentId}`,
        `/v1/external/orders/show/${shipmentId}`
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(`${BASE_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            lastError = error;
            continue;
        }
    }

    throw lastError || new Error('All verification endpoints failed');
}

async function generateLabel(shipmentId) {
    const MAX_RETRIES = 5; // Increased from 3
    const INITIAL_DELAY = 5000; // Increased from 2000ms
    
    try {
        const authToken = await getToken();
        let lastError = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                // Progressive delay with exponential backoff
                const delay = attempt === 0 ? 0 : INITIAL_DELAY * Math.pow(2, attempt - 1);
                if (delay > 0) {
                    console.log(`Waiting ${delay}ms before label generation attempt ${attempt + 1}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Use ONLY the documented endpoint
                const response = await axios.post(
                    `${BASE_URL}/v1/external/courier/generate/label`,
                    { shipment_id: [shipmentId] }, // Note: Array format is required
                    {
                        headers: { 
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    }
                );

                if (response.data?.label_url) {
                    return {
                        ...response.data,
                        status: 'generated'
                    };
                }

                throw new Error('Label URL missing in response');

            } catch (error) {
                lastError = error;
                console.warn(`Label generation attempt ${attempt + 1} failed:`, error.message);
                if (attempt < MAX_RETRIES - 1) continue;
                
                throw new Error(`Label generation failed after ${MAX_RETRIES} attempts: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('Label generation failed:', {
            status: error.response?.status,
            data: error.response?.data,
            shipmentId,
            timestamp: new Date()
        });
        throw error;
    }
}

async function getShipmentStatus(shipmentId) {
    if (!shipmentId) throw new Error(`Invalid shipmentId: ${shipmentId}`);
    const authToken = await getToken();
    const response = await axios.get(
        `${BASE_URL}/v1/external/shipments/${shipmentId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
}

async function trackShipment(awbCode) {
    try {
        const authToken = await getToken();
        
        const response = await axios.get(
            `${BASE_URL}/v1/external/courier/track/awb/${awbCode}`,
            {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 10000
            }
        );

        const trackingData = response.data?.tracking_data || {};
        return {
            status: trackingData.shipment_status || 'Unknown',
            trackingHistory: (trackingData.shipment_track || []).map(item => ({
                status: item.status,
                location: item.location,
                date: new Date(item.updated_date),
                remark: item.remark || ''
            })),
            estimatedDelivery: trackingData.etd ? new Date(trackingData.etd) : null
        };
    } catch (error) {
        console.error('Shipment tracking failed:', error.message);
        return {
            status: 'Tracking Unavailable',
            trackingHistory: [],
            error: error.message
        };
    }
}

module.exports = {
    createOrder,
    assignAWB,
    generatePickup,
    generateLabel,
    getShipmentStatus,
    trackShipment
};