import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount:{
        type: Number,
        required: true,
    },
    dishesId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dishes',
    },
    olxId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OLX',
    }
})

const Order = mongoose.model('Order', orderSchema);
export default Order;