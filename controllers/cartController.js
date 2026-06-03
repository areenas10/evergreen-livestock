const Product = require('../models/Product');
const Cart = require('../models/Cart');

const getCart = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        let cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            cart = new Cart({ userId, items: [], total_price: 0 });
            await cart.save();
        }

        // Automatically clean up orphaned items (products that were deleted from the database)
        const originalCount = cart.items.length;
        cart.items = cart.items.filter(item => item.productId != null);
        
        if (cart.items.length !== originalCount) {
            cart.total_price = cart.items.reduce((acc, item) => acc + (item.price || 0), 0);
            await cart.save();
        }

        const cartData = {
            items: cart.items || [],
            totalPrice: cart.total_price
        };

        res.redirect('/user/checkout');
    } catch (err) {
        console.error(err);
        res.redirect('/user/dashboard');
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, selectedVariantIndexes, selectedVariantIndex, quantity } = req.body;
        const userId = req.session.user.id;

        // Get product
        const product = await Product.findById(productId);
        if (!product) throw new Error('Product not found');

        const liveAnimalCategories = ['Goats', 'Ducks', 'Rabbits', 'Pigeons'];
        const isLiveAnimal = liveAnimalCategories.includes(product.category);

        // Get or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [], total_price: 0 });
        }

        if (isLiveAnimal) {
            // Live animal: selectedVariantIndexes is an array of variant indexes to add (one unit of each)
            let indexes = [];
            if (Array.isArray(selectedVariantIndexes)) {
                indexes = selectedVariantIndexes.map(idx => parseInt(idx) || 0);
            } else if (selectedVariantIndexes !== undefined) {
                indexes = [parseInt(selectedVariantIndexes) || 0];
            } else if (selectedVariantIndex !== undefined) {
                indexes = [parseInt(selectedVariantIndex) || 0];
            } else {
                indexes = [0]; // default fallback
            }

            // Loop through each selected variant index and add exactly 1 to cart
            for (const variantIdx of indexes) {
                let variant = null;
                if (product.weightVariants && product.weightVariants.length > 0) {
                    variant = product.weightVariants[variantIdx];
                }

                const itemPrice = variant ? variant.price : product.price;
                const itemImage = (variant && variant.images && variant.images.length > 0) ? variant.images[0] : product.image;
                const itemStock = variant ? variant.stock : product.stock;
                const itemWeight = variant ? variant.weight : product.weight;

                // Find if this specific variant is already in the cart
                const itemIndex = cart.items.findIndex(item => 
                    item.productId.toString() === productId && item.selectedWeight === itemWeight
                );

                if (itemIndex > -1) {
                    const currentQty = cart.items[itemIndex].quantity;
                    const availableToAdd = itemStock - currentQty;
                    
                    if (availableToAdd > 0) {
                        cart.items[itemIndex].quantity += 1;
                        cart.items[itemIndex].price = itemPrice * cart.items[itemIndex].quantity;
                    }
                } else {
                    if (itemStock > 0) {
                        cart.items.push({
                            productId: productId,
                            quantity: 1,
                            price: itemPrice,
                            image: itemImage,
                            selectedWeight: itemWeight
                        });
                    }
                }
            }
        } else {
            // Standard product: single selected variant, with a specified quantity
            let variantIdx = 0;
            if (selectedVariantIndex !== undefined) {
                variantIdx = parseInt(selectedVariantIndex) || 0;
            } else if (Array.isArray(selectedVariantIndexes)) {
                variantIdx = parseInt(selectedVariantIndexes[0]) || 0;
            } else if (selectedVariantIndexes !== undefined) {
                variantIdx = parseInt(selectedVariantIndexes) || 0;
            }

            let variant = null;
            if (product.weightVariants && product.weightVariants.length > 0) {
                variant = product.weightVariants[variantIdx];
            }

            const itemPrice = variant ? variant.price : product.price;
            const itemImage = (variant && variant.images && variant.images.length > 0) ? variant.images[0] : product.image;
            const itemStock = variant ? variant.stock : product.stock;
            const itemWeight = variant ? variant.weight : product.weight;

            const qtyToAdd = Math.max(1, parseInt(quantity) || 1);

            // Find if this specific variant is already in the cart
            const itemIndex = cart.items.findIndex(item => 
                item.productId.toString() === productId && item.selectedWeight === itemWeight
            );

            if (itemIndex > -1) {
                const currentQty = cart.items[itemIndex].quantity;
                const availableToAdd = itemStock - currentQty;
                const actualQtyToAdd = Math.min(qtyToAdd, availableToAdd);
                
                if (actualQtyToAdd > 0) {
                    cart.items[itemIndex].quantity += actualQtyToAdd;
                    cart.items[itemIndex].price = itemPrice * cart.items[itemIndex].quantity;
                }
            } else {
                const actualQtyToAdd = Math.min(qtyToAdd, itemStock);
                if (actualQtyToAdd > 0) {
                    cart.items.push({
                        productId: productId,
                        quantity: actualQtyToAdd,
                        price: itemPrice * actualQtyToAdd,
                        image: itemImage,
                        selectedWeight: itemWeight
                    });
                }
            }
        }

        // Recalculate total price
        cart.total_price = cart.items.reduce((acc, item) => acc + item.price, 0);
        cart.updatedAt = Date.now();
        
        await cart.save();

        res.redirect('/user/checkout');
    } catch (err) {
        console.error(err);
        res.redirect('/products');
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId, selectedWeight } = req.body;
        const userId = req.session.user.id;

        const cart = await Cart.findOne({ userId });
        if (cart) {
            cart.items = cart.items.filter(item => 
                !(item.productId.toString() === productId && item.selectedWeight === selectedWeight)
            );
            
            // Recalculate total
            cart.total_price = cart.items.reduce((acc, item) => acc + (item.price || 0), 0);
            cart.updatedAt = Date.now();
            await cart.save();
        }
        res.redirect('/user/checkout');
    } catch (err) {
        console.error(err);
        res.redirect('/user/checkout');
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        const { productId, quantity, selectedWeight } = req.body;
        const userId = req.session.user.id;
        const itemQuantity = parseInt(quantity);

        const cart = await Cart.findOne({ userId });
        if (cart && itemQuantity > 0) {
            const product = await Product.findById(productId);
            // Identify by both productId and selectedWeight
            const itemIndex = cart.items.findIndex(item => 
                item.productId.toString() === productId && item.selectedWeight === selectedWeight
            );
            
            if (itemIndex > -1) {
                const item = cart.items[itemIndex];
                
                // Find matching variant based on stored weight
                let variant = null;
                if (product && product.weightVariants && product.weightVariants.length > 0) {
                    variant = product.weightVariants.find(v => v.weight === item.selectedWeight);
                }
                
                const unitPrice = variant ? variant.price : (product ? product.price : (item.price / item.quantity)); 
                const maxStock = variant ? variant.stock : (product ? product.stock : itemQuantity); // Fallback

                // Ensure quantity does not exceed stock
                const finalQty = Math.min(itemQuantity, maxStock);

                cart.items[itemIndex].quantity = finalQty;
                cart.items[itemIndex].price = unitPrice * finalQty;
                
                // Recalculate total
                cart.total_price = cart.items.reduce((acc, item) => acc + item.price, 0);
                cart.updatedAt = Date.now();
                await cart.save();
            }
        }
        res.redirect('/user/checkout');
    } catch (err) {
        console.error(err);
        res.redirect('/user/checkout');
    }
};

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity
};
