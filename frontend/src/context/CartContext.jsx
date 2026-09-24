import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);
const getStorageKey = (userId) => `canteen-cart:${userId}`;

const readCart = (userId) => {
  if (!userId) return [];

  try {
    const stored = JSON.parse(localStorage.getItem(getStorageKey(userId)) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) =>
      item && typeof item.productId === "string" && Number.isInteger(item.quantity) && item.quantity > 0
    );
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id || user?._id || null;
  const [cartState, setCartState] = useState({ userId: null, items: [] });
  const cartStateRef = useRef(cartState);

  useEffect(() => {
    const nextState = { userId, items: readCart(userId) };
    cartStateRef.current = nextState;
    setCartState(nextState);
  }, [userId]);

  const commitItems = useCallback((items) => {
    if (!userId) return;
    const nextState = { userId, items };
    cartStateRef.current = nextState;
    setCartState(nextState);
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
    } catch {
      // Keep the in-memory cart usable when browser storage is unavailable.
    }
  }, [userId]);

  const updateItems = useCallback((update) => {
    if (!userId) return;
    const currentItems = cartStateRef.current.userId === userId
      ? cartStateRef.current.items
      : readCart(userId);
    commitItems(update(currentItems));
  }, [commitItems, userId]);

  const addItem = useCallback((product) => {
    if (!userId || !product?._id || product.isAvailable === false) return false;

    updateItems((items) => {
      const existingItem = items.find((item) => item.productId === product._id);
      if (existingItem) {
        return items.map((item) => item.productId === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }

      return [...items, {
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.image || "",
        quantity: 1,
      }];
    });
    return true;
  }, [updateItems, userId]);

  const setQuantity = useCallback((productId, quantity) => {
    if (!Number.isInteger(quantity)) return;
    updateItems((items) => items.map((item) => item.productId === productId
      ? { ...item, quantity: Math.max(1, quantity) }
      : item));
  }, [updateItems]);

  const removeItem = useCallback((productId) => {
    updateItems((items) => items.filter((item) => item.productId !== productId));
  }, [updateItems]);

  const clearCart = useCallback(() => {
    commitItems([]);
  }, [commitItems]);

  const items = cartState.userId === userId ? cartState.items : [];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value = useMemo(() => ({
    items,
    itemCount,
    total,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  }), [items, itemCount, total, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
