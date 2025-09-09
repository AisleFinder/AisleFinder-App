// In your project's root folder, create a file named .env.local
// Add your variables to it like this:
// REACT_APP_GEMINI_API_KEY="YOUR_API_KEY_GOES_HERE"
// REACT_APP_FIREBASE_CONFIG='{"apiKey":"...", "authDomain":"...", ...}'

import React, { useState, useEffect, useMemo, useRef, useReducer, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import {
    getFirestore,
    collection,
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    deleteDoc
} from 'firebase/firestore';
import { Search, MapPin, Edit, X, Send, LoaderCircle, PackageSearch, Store, Building2, PlusCircle, Plus, LocateFixed, ShoppingCart, Sparkles, ChefHat, LogOut, ListPlus, User, Settings, HelpCircle, Shield, FileText, Heart, Trash2, PlusSquare, Clock } from 'lucide-react';

// --- Helper Functions ---
const formatTimestamp = (firebaseTimestamp) => {
    if (!firebaseTimestamp) return 'Not yet updated';
    const date = firebaseTimestamp.toDate();
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) return `${diffDays} days ago`;
    if (diffDays === 1) return `1 day ago`;
    if (diffHours > 1) return `${diffHours} hours ago`;
    if (diffHours === 1) return `1 hour ago`;
    if (diffMinutes > 1) return `${diffMinutes} minutes ago`;
    if (diffMinutes === 1) return `1 minute ago`;
    return 'Just now';
};

const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const fetchWithBackoff = async (url, options, retries = 4, initialDelay = 1000) => {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status >= 400 && response.status < 500) {
                 throw new Error(`Client-side error: ${response.status} ${response.statusText}`);
            }
            lastError = new Error(`API call failed with status: ${response.status}`);
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${i + 1} failed: ${error.message}. Retrying...`);
        }
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw lastError;
};

// --- Constants ---
const productCategories = [ 'Milk', 'Bread', 'Cheese', 'Eggs', 'Yogurt', 'Apples', 'Bananas', 'Tomatoes', 'Potatoes', 'Chicken', 'Beef', 'Sausages', 'Fish', 'Pasta', 'Rice', 'Cereal', 'Soup', 'Juice', 'Water', 'Fizzy Drinks', 'Crisps', 'Biscuits', 'Chocolate', 'Cleaning Spray', 'Toilet Roll', 'Shampoo', 'Other...' ];
const productUnits = [ 'Select unit', 'L', 'ml', 'kg', 'g', 'pack', 'bottle', 'can', 'loaf', 'box', 'jar' ];

// --- State Management (useReducer) ---
const initialState = {
    db: null,
    auth: null,
    user: null,
    userId: null,
    isGuest: false,
    isAuthReady: false,
    isProfileMenuOpen: false,
    isSettingsModalOpen: false,
    isAddRecipeModalOpen: false,
    stores: [],
    selectedStore: null,
    isStoreModalOpen: false,
    storeSearchTerm: '',
    products: [],
    searchTerm: '',
    isLoading: true,
    isProductsLoading: false,
    error: null,
    selectedProduct: null,
    isUpdateModalOpen: false,
    newAisle: '',
    newLocationInAisle: '',
    isUpdating: false,
    isAddProductModalOpen: false,
    newProductCategory: productCategories[0],
    customCategory: '',
    newProductQuantity: '',
    newProductUnit: productUnits[0],
    newProductAisle: '',
    newProductLocationInAisle: '',
    isAddingProduct: false,
    isAddStoreModalOpen: false,
    newStoreName: '',
    newStoreAddress: '',
    isAddingStore: false,
    addStoreError: null,
    isFindingAddress: false,
    deviceLocation: null,
    searchLocation: null,
    manualLocationInput: "",
    isManualLocationModalOpen: false,
    isGeocoding: false,
    locationError: null,
    isLocating: true,
    searchRadius: 5,
    shoppingList: [],
    isListModalOpen: false,
    recipe: null,
    isGeneratingRecipe: false,
    recipeError: null,
    favouriteRecipes: [],
    isFavRecipesModalOpen: false,
    aiListInput: '',
    generatedItems: [],
    selectedAiItems: {},
    isGeneratingList: false,
    aiListError: null,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.payload };
        case 'INITIALIZE_FIREBASE':
            return { ...state, db: action.payload.db, auth: action.payload.auth };
        case 'SET_AUTH_STATE':
            return { ...state, user: action.payload.user, userId: action.payload.userId, isGuest: action.payload.isGuest, isAuthReady: true };
        case 'OPEN_UPDATE_MODAL':
            return {
                ...state,
                selectedProduct: action.payload,
                newAisle: action.payload.aisle || '',
                newLocationInAisle: action.payload.locationInAisle || '',
                isUpdateModalOpen: true,
            };
        case 'CLOSE_UPDATE_MODAL':
            return {
                ...state,
                isUpdateModalOpen: false,
                selectedProduct: null,
                newAisle: '',
                newLocationInAisle: '',
                isUpdating: false,
            };
        case 'CLOSE_ADD_PRODUCT_MODAL':
            return {
                ...state,
                isAddProductModalOpen: false,
                newProductCategory: productCategories[0],
                customCategory: '',
                newProductQuantity: '',
                newProductUnit: productUnits[0],
                newProductAisle: '',
                newProductLocationInAisle: '',
                isAddingProduct: false,
            };
        case 'CLOSE_ADD_STORE_MODAL':
            return {
                ...state,
                isAddStoreModalOpen: false,
                newStoreName: '',
                newStoreAddress: '',
                addStoreError: null,
            };
        case 'ADD_TO_SHOPPING_LIST':
            if (state.shoppingList.find(item => item.id === action.payload.id)) {
                return state;
            }
            return { ...state, shoppingList: [...state.shoppingList, action.payload] };
        case 'REMOVE_FROM_SHOPPING_LIST':
            return { ...state, shoppingList: state.shoppingList.filter(item => item.id !== action.payload) };
        case 'CLEAR_SHOPPING_LIST':
            return { ...state, shoppingList: [] };
        case 'ADD_AI_ITEMS_TO_LIST':
            return {
                ...state,
                shoppingList: [...state.shoppingList, ...action.payload],
                generatedItems: [],
                selectedAiItems: {},
                aiListInput: '',
            };
        default:
            return state;
    }
}


// --- UI Components ---
const LoginScreen = ({ onGoogleSignIn, onGuestSignIn, error }) => (
    <div className="bg-gray-50 text-gray-800 h-screen w-screen font-sans flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm z-20 flex-shrink-0">
            <div className="w-full max-w-4xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-2"> <MapPin className="text-green-600" size={24} /> <h1 className="text-xl font-bold text-green-600">AisleFinder</h1> </div>
            </div>
        </header>
        <div className="flex-grow flex flex-col items-center justify-center text-center p-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
            <p className="text-gray-600 mb-8">Sign in to contribute or continue as a guest to browse.</p>
            <div className="space-y-4">
                <button onClick={onGoogleSignIn} className="flex w-full items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors text-lg shadow-md">
                    <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    <span>Sign in with Google</span>
                </button>
                <button onClick={onGuestSignIn} className="flex w-full items-center justify-center gap-3 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg shadow-md">
                    <User size={24} />
                    <span>Continue as Guest</span>
                </button>
            </div>
            {error && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800 shadow-lg">{error}</div>}
        </div>
    </div>
);

const SettingsModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in"> <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl border border-gray-200 relative"> <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button> <h3 className="text-2xl font-bold mb-6 text-green-600 flex items-center gap-2"><Settings/> Settings</h3> <div className="space-y-3"> <button type="button" className="w-full text-left flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"> <HelpCircle className="text-gray-600"/> <span className="font-semibold text-gray-700">Help & Support</span> </button> <button type="button" className="w-full text-left flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"> <Shield className="text-gray-600"/> <span className="font-semibold text-gray-700">Privacy Policy</span> </button> <button type="button" className="w-full text-left flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"> <FileText className="text-gray-600"/> <span className="font-semibold text-gray-700">Terms of Service</span> </button> </div> </div> </div> );
};

const FavouriteRecipesModal = ({ isOpen, onClose, recipes, onRemove }) => {
    if (!isOpen) return null;
    return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in"> <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl border border-gray-200 flex flex-col" style={{height: 'min(90vh, 800px)'}}> <div className="flex justify-between items-center mb-4 flex-shrink-0"> <h3 className="text-2xl font-bold text-green-600 flex items-center gap-2"><Heart/> Favourite Recipes</h3> <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button> </div> <div className="overflow-y-auto flex-grow pr-2"> {recipes.length > 0 ? ( <div className="space-y-4"> {recipes.map(recipe => ( <div key={recipe.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200"> <div className="flex justify-between items-start"> <h4 className="font-bold text-lg text-green-700">{recipe.recipeName}</h4> <button onClick={() => onRemove(recipe.id)} className="text-red-500 hover:text-red-700 flex-shrink-0 ml-2"><Trash2 size={16}/></button> </div> <p className="text-gray-600 italic text-sm mt-1">{recipe.description}</p> <div className="text-sm mt-3"> <h5 className="font-semibold text-gray-800">Ingredients you have:</h5> <ul className="list-disc list-inside text-gray-600"> {recipe.ingredientsUsed.map((ing, i) => <li key={i}>{ing}</li>)} </ul> </div> {recipe.missingIngredients && recipe.missingIngredients.length > 0 && ( <div className="text-sm mt-2"> <h5 className="font-semibold text-orange-600">You might also need:</h5> <ul className="list-disc list-inside text-gray-600"> {recipe.missingIngredients.map((ing, i) => <li key={i}>{ing}</li>)} </ul> </div> )} <div className="text-sm mt-2"> <h5 className="font-semibold text-gray-800">Instructions:</h5> <ol className="list-decimal list-inside space-y-1 text-gray-600"> {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)} </ol> </div> </div> ))} </div> ) : ( <p className="text-center text-gray-500 p-10">You haven't saved any favourite recipes yet.</p> )} </div> </div> </div> );
};

const AddRecipeModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [instructions, setInstructions] = useState('');
    if (!isOpen) return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ recipeName: name, description, ingredientsUsed: ingredients.split('\n').filter(i => i.trim() !== ''), missingIngredients: [], instructions: instructions.split('\n').filter(i => i.trim() !== ''), });
        onClose(); setName(''); setDescription(''); setIngredients(''); setInstructions('');
    };
    return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in"> <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl border border-gray-200 relative"> <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button> <h3 className="text-2xl font-bold mb-6 text-green-600 flex items-center gap-2"><PlusSquare/> Add a Recipe</h3> <form onSubmit={handleSubmit} className="space-y-4"> <div> <label htmlFor="recipeName" className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label> <input id="recipeName" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required/> </div> <div> <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label> <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows="2" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800"></textarea> </div> <div> <label htmlFor="ingredients" className="block text-sm font-medium text-gray-700 mb-1">Ingredients (one per line)</label> <textarea id="ingredients" value={ingredients} onChange={e => setIngredients(e.target.value)} rows="4" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required></textarea> </div> <div> <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">Instructions (one per line)</label> <textarea id="instructions" value={instructions} onChange={e => setInstructions(e.target.value)} rows="4" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required></textarea> </div> <button type="submit" className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md transition-colors"> Save Recipe </button> </form> </div> </div> );
};


// --- Main App Component ---
export default function App() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const {
        db, auth, user, userId, isGuest, isAuthReady, isProfileMenuOpen, isSettingsModalOpen,
        isAddRecipeModalOpen, stores, selectedStore, isStoreModalOpen, storeSearchTerm, products,
        searchTerm, isLoading, isProductsLoading, error, selectedProduct, isUpdateModalOpen,
        newAisle, newLocationInAisle, isUpdating, isAddProductModalOpen, newProductCategory,
        customCategory, newProductQuantity, newProductUnit, newProductAisle, newProductLocationInAisle,
        isAddingProduct, isAddStoreModalOpen, newStoreName, newStoreAddress, isAddingStore,
        addStoreError, isFindingAddress, deviceLocation, searchLocation, manualLocationInput,
        isManualLocationModalOpen, isGeocoding, locationError, isLocating, searchRadius,
        shoppingList, isListModalOpen, recipe, isGeneratingRecipe, recipeError, favouriteRecipes,
        isFavRecipesModalOpen, aiListInput, generatedItems, selectedAiItems, isGeneratingList,
        aiListError
    } = state;

    const profileMenuRef = useRef(null);

    // --- Firestore Path Constants ---
    const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'local-dev-app';
    const storesCollectionPath = `artifacts/${appId}/public/data/stores`;

    const getProductsCollectionPath = useCallback((storeId) => `${storesCollectionPath}/${storeId}/products`, [storesCollectionPath]);
    const getFavRecipesCollectionPath = useCallback((uid) => `artifacts/${appId}/users/${uid}/favouriteRecipes`, [appId]);


    // --- Firebase Initialization Effect ---
    useEffect(() => {
        try {
            const firebaseConfigStr = typeof window.__firebase_config !== 'undefined' ? window.__firebase_config : '{}';

            if (firebaseConfigStr === '{}') {
                console.warn("Firebase config is not available. Using placeholder. App will not connect to Firebase locally.");
            }
            const firebaseConfig = JSON.parse(firebaseConfigStr);

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            dispatch({ type: 'INITIALIZE_FIREBASE', payload: { db: firestoreDb, auth: firebaseAuth } });

            const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : undefined;

            onAuthStateChanged(firebaseAuth, async (currentUser) => {
                let finalUser = currentUser;
                if (!currentUser && initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                    return;
                }

                dispatch({
                    type: 'SET_AUTH_STATE',
                    payload: {
                        user: finalUser,
                        userId: finalUser?.uid,
                        isGuest: finalUser ? finalUser.isAnonymous : false,
                    }
                });
            });
        } catch (e) {
            console.error("Firebase initialization error:", e);
        dispatch({ type: 'SET_FIELD', field: 'error', payload: e.message });
        dispatch({ type: 'SET_FIELD', field: 'isLoading', payload: false });
    }
}, []);

// --- Geolocation Effect ---
useEffect(() => {
    if (navigator.geolocation) {
        const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = { lat: position.coords.latitude, lng: position.coords.longitude };
                dispatch({ type: 'SET_FIELD', field: 'deviceLocation', payload: location });
                dispatch({ type: 'SET_FIELD', field: 'searchLocation', payload: location });
                dispatch({ type: 'SET_FIELD', field: 'isLocating', payload: false });
            },
            (error) => {
                console.error("Geolocation failed:", error.message || "An unknown error occurred.");
                let errorMessage;
                switch(error.code) {
                    case 1:
                        errorMessage = error.message.includes("permissions policy")
                            ? "Location is blocked by the browser in this preview. Please open the app in a new tab to use location features. You can still search for stores by name."
                            : "Location access denied. Please enable location permissions for this site in your browser settings.";
                        break;
                    case 2: errorMessage = "Location information is unavailable. This can be caused by a poor GPS signal or network issues."; break;
                    case 3: errorMessage = "Could not get your location in time. Please try refreshing, or set your location manually."; break;
                    default: errorMessage = "Could not get your location. Please ensure location services are enabled and try again."; break;
                }
                dispatch({ type: 'SET_FIELD', field: 'locationError', payload: errorMessage });
                dispatch({ type: 'SET_FIELD', field: 'searchLocation', payload: null });
                dispatch({ type: 'SET_FIELD', field: 'isLocating', payload: false });
            },
            options
        );
    } else {
        dispatch({ type: 'SET_FIELD', field: 'locationError', payload: "Geolocation is not supported by your browser." });
        dispatch({ type: 'SET_FIELD', field: 'searchLocation', payload: null });
        dispatch({ type: 'SET_FIELD', field: 'isLocating', payload: false });
    }
}, []);

// --- Fetch Community Stores Effect ---
useEffect(() => {
    if (!db || !isAuthReady || !userId) return;

    const timeoutId = setTimeout(() => {
        console.error("Firestore timeout: Could not fetch stores in 10 seconds.");
        dispatch({ type: 'SET_FIELD', field: 'error', payload: "Could not connect to the database. Please check your connection and try again." });
        dispatch({ type: 'SET_FIELD', field: 'isLoading', payload: false });
    }, 10000);

    const storesRef = collection(db, storesCollectionPath);
    const unsubscribe = onSnapshot(storesRef, (snapshot) => {
        clearTimeout(timeoutId);
        const storesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isCommunity: true }));
        dispatch({ type: 'SET_FIELD', field: 'stores', payload: storesData });
        if (!selectedStore && user) {
            dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: true });
        }
        dispatch({ type: 'SET_FIELD', field: 'isLoading', payload: false });
    }, (err) => {
        clearTimeout(timeoutId);
        console.error("Error fetching stores:", err);
        dispatch({ type: 'SET_FIELD', field: 'error', payload: "Could not fetch store data." });
        dispatch({ type: 'SET_FIELD', field: 'isLoading', payload: false });
    });

    return () => {
        unsubscribe();
        clearTimeout(timeoutId);
    };
}, [db, isAuthReady, userId, selectedStore, user, storesCollectionPath]);

// --- Product Fetching Effect ---
useEffect(() => {
    if (!db || !isAuthReady || !selectedStore || !selectedStore.isCommunity) {
            dispatch({ type: 'SET_FIELD', field: 'products', payload: [] });
            return;
        }
        dispatch({ type: 'SET_FIELD', field: 'isProductsLoading', payload: true });
        const productsPath = getProductsCollectionPath(selectedStore.id);
        const unsubscribe = onSnapshot(collection(db, productsPath), (snapshot) => {
             const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            productsData.sort((a, b) => a.name.localeCompare(b.name));
            dispatch({ type: 'SET_FIELD', field: 'products', payload: productsData });
            dispatch({ type: 'SET_FIELD', field: 'isProductsLoading', payload: false });
        }, (err) => {
            dispatch({ type: 'SET_FIELD', field: 'error', payload: `Could not fetch product data for ${selectedStore.name}.` });
            dispatch({ type: 'SET_FIELD', field: 'isProductsLoading', payload: false });
        });
        return () => unsubscribe();
    }, [db, isAuthReady, selectedStore, getProductsCollectionPath]);

    // --- Fetch Favourite Recipes Effect ---
    useEffect(() => {
        if (db && userId && !isGuest) {
            const favRecipesPath = getFavRecipesCollectionPath(userId);
            const unsubscribe = onSnapshot(collection(db, favRecipesPath), (snapshot) => {
                const favs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                dispatch({ type: 'SET_FIELD', field: 'favouriteRecipes', payload: favs });
            });
            return () => unsubscribe();
        }
    }, [db, userId, isGuest, getFavRecipesCollectionPath]);

    // --- Effect to close dropdown on outside click ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                dispatch({ type: 'SET_FIELD', field: 'isProfileMenuOpen', payload: false });
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [profileMenuRef]);


    // --- Memoized Filtering ---
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, products]);

    const combinedStores = useMemo(() => {
        let storesWithDistance = stores.map(store => {
            if (searchLocation && store.lat && store.lng) {
                const distance = getDistanceInMiles(searchLocation.lat, searchLocation.lng, store.lat, store.lng);
                return { ...store, distance };
            }
            return { ...store, distance: Infinity };
        });

        if (searchLocation) {
            storesWithDistance.sort((a, b) => a.distance - b.distance);
        } else {
             storesWithDistance.sort((a,b) => a.name.localeCompare(b.name));
        }

        if (!storeSearchTerm) return storesWithDistance;

        return storesWithDistance.filter(store =>
            store.name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
            store.address.toLowerCase().includes(storeSearchTerm.toLowerCase())
        );
    }, [storeSearchTerm, stores, searchLocation]);

    const groupedShoppingList = useMemo(() => {
        return shoppingList.reduce((acc, item) => {
            const aisle = item.aisle || 'Uncategorized';
            if (!acc[aisle]) acc[aisle] = [];
            acc[aisle].push(item);
            return acc;
        }, {});
    }, [shoppingList]);

    // --- API Calls ---
    const geocodeAddressWithGemini = async (address) => {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: `Geocode this address: "${address}, UK"` }] }],
            systemInstruction: { parts: [{ text: `You are a geocoding service. Respond ONLY with a JSON object containing 'lat' and 'lng' keys.` }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: { type: "OBJECT", properties: { "lat": { "type": "NUMBER" }, "lng": { "type": "NUMBER" } }, required: ["lat", "lng"] }
            }
        };
        const response = await fetchWithBackoff(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("Geocoding failed.");
        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
             return JSON.parse(candidate.content.parts[0].text);
        }
        throw new Error("Invalid response from geocoding API.");
    };

    const handleGenerateRecipe = async () => {
        if (shoppingList.length === 0) {
            dispatch({ type: 'SET_FIELD', field: 'recipeError', payload: "Your shopping list is empty. Add some items to get a recipe idea!" });
            return;
        }
        dispatch({ type: 'SET_FIELD', field: 'isGeneratingRecipe', payload: true });
        dispatch({ type: 'SET_FIELD', field: 'recipe', payload: null });
        dispatch({ type: 'SET_FIELD', field: 'recipeError', payload: null });

        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const ingredientList = shoppingList.map(item => item.name).join(', ');
        const systemPrompt = "You are a helpful and creative chef... Respond ONLY with a valid JSON object...";
        const userQuery = `My shopping list: [${ingredientList}]. Generate a simple recipe...`;
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "recipeName": { "type": "STRING" }, "description": { "type": "STRING" },
                        "ingredientsUsed": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "missingIngredients": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "instructions": { "type": "ARRAY", "items": { "type": "STRING" } }
                    },
                    required: ["recipeName", "description", "ingredientsUsed", "missingIngredients", "instructions"]
                }
            }
        };

        try {
            const response = await fetchWithBackoff(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const parsedJson = JSON.parse(candidate.content.parts[0].text);
                dispatch({ type: 'SET_FIELD', field: 'recipe', payload: parsedJson });
            } else {
                throw new Error("Unexpected response format from API.");
            }
        } catch(err) {
            console.error("Gemini Recipe Error:", err);
            dispatch({ type: 'SET_FIELD', field: 'recipeError', payload: "Sorry, I couldn't generate a recipe right now. Please try again." });
        } finally {
            dispatch({ type: 'SET_FIELD', field: 'isGeneratingRecipe', payload: false });
        }
    };

    const handleFindAddress = async () => {
        if (!deviceLocation) {
            dispatch({ type: 'SET_FIELD', field: 'addStoreError', payload: "Could not get your phone's location to find an address." });
            return;
        }
        dispatch({ type: 'SET_FIELD', field: 'isFindingAddress', payload: true });
        dispatch({ type: 'SET_FIELD', field: 'addStoreError', payload: null });

        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: `What is the street address for the coordinates: latitude ${deviceLocation.lat}, longitude ${deviceLocation.lng}?` }] }],
            systemInstruction: { parts: [{ text: `You are a reverse geocoding service. Respond ONLY with a JSON object containing a single key "address".` }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: { type: "OBJECT", properties: { "address": { "type": "STRING" } }, required: ["address"] }
            }
        };

        try {
            const response = await fetchWithBackoff(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            const candidate = result.candidates?.[0];
            if (candidate && candidate.content?.parts?.[0]?.text) {
                 const parsed = JSON.parse(candidate.content.parts[0].text);
                 dispatch({ type: 'SET_FIELD', field: 'newStoreAddress', payload: parsed.address });
            } else {
                throw new Error("Invalid response from address finding API.");
            }
        } catch (err) {
            console.error(err);
            dispatch({ type: 'SET_FIELD', field: 'addStoreError', payload: "Could not automatically find address. Please enter it manually." });
        } finally {
            dispatch({ type: 'SET_FIELD', field: 'isFindingAddress', payload: false });
        }
    };

    const handleManualLocationSearch = async (e) => {
        e.preventDefault();
        if (!manualLocationInput) return;
        dispatch({ type: 'SET_FIELD', field: 'isGeocoding', payload: true });
        dispatch({ type: 'SET_FIELD', field: 'locationError', payload: null });
        try {
            const coords = await geocodeAddressWithGemini(manualLocationInput);
            dispatch({ type: 'SET_FIELD', field: 'searchLocation', payload: coords });
            dispatch({ type: 'SET_FIELD', field: 'isManualLocationModalOpen', payload: false });
        } catch (err) {
             dispatch({ type: 'SET_FIELD', field: 'locationError', payload: "Could not find that location. Please try being more specific." });
        } finally {
            dispatch({ type: 'SET_FIELD', field: 'isGeocoding', payload: false });
        }
    };

     const handleGenerateList = async (e) => {
         e.preventDefault();
         if (!aiListInput.trim()) return;

         dispatch({ type: 'SET_FIELD', field: 'isGeneratingList', payload: true });
         dispatch({ type: 'SET_FIELD', field: 'aiListError', payload: null });
         dispatch({ type: 'SET_FIELD', field: 'generatedItems', payload: [] });

         const apiKey = "";
         const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
         const systemPrompt = `You are a shopping list assistant...`;
         const payload = {
             contents: [{ parts: [{ text: `Create a shopping list for: "${aiListInput}"` }] }],
             systemInstruction: { parts: [{ text: systemPrompt }] },
             generationConfig: {
                 responseMimeType: "application/json",
                 responseSchema: {
                     type: "OBJECT", properties: { "items": { type: "ARRAY", items: {
                         type: "OBJECT", properties: { "name": { "type": "STRING" }, "quantity": { "type": "STRING" } }, required: ["name", "quantity"]
                     }}}, required: ["items"]
                 }
             }
         };

         try {
             const response = await fetchWithBackoff(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
             const result = await response.json();
             const candidate = result.candidates?.[0];
             if (candidate?.content?.parts?.[0]?.text) {
                 const parsed = JSON.parse(candidate.content.parts[0].text);
                 if (parsed?.items?.length) {
                     dispatch({ type: 'SET_FIELD', field: 'generatedItems', payload: parsed.items });
                 } else {
                     dispatch({ type: 'SET_FIELD', field: 'aiListError', payload: "The AI couldn't generate any items for that request. Please try being more specific." });
                 }
             } else {
                  throw new Error("Invalid response from list generation API.");
             }
         } catch (err) {
             console.error("Gemini List Error:", err);
             dispatch({ type: 'SET_FIELD', field: 'aiListError', payload: "Sorry, I couldn't generate a list right now. Please try again." });
         } finally {
             dispatch({ type: 'SET_FIELD', field: 'isGeneratingList', payload: false });
         }
     };


    // --- Authentication Handlers ---
    const handleGoogleSignIn = async () => {
        if (!auth) return;
        try { await signInWithPopup(auth, new GoogleAuthProvider()); }
        catch (error) {
            console.error("Google Sign-In Error:", error);
            dispatch({ type: 'SET_FIELD', field: 'error', payload: "Could not sign in with Google. Please try again." });
        }
    };

    const handleGuestSignIn = async () => {
        if (!auth) return;
         try { await signInAnonymously(auth); }
         catch (error) {
            console.error("Guest Sign-In Error:", error);
            dispatch({ type: 'SET_FIELD', field: 'error', payload: "Could not sign in as a guest. Please try again." });
        }
    };

    const handleSignOut = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            dispatch({ type: 'SET_AUTH_STATE', payload: { user: null, userId: null, isGuest: false } });
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };


    // --- Event Handlers ---
    const handleStoreSelect = (store) => {
        dispatch({ type: 'SET_FIELD', field: 'selectedStore', payload: store });
        dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: false });
    };

    const handleUpdateClick = (product) => dispatch({ type: 'OPEN_UPDATE_MODAL', payload: product });
    const handleUpdateModalClose = () => dispatch({ type: 'CLOSE_UPDATE_MODAL' });
    const handleAddProductModalOpen = () => dispatch({ type: 'SET_FIELD', field: 'isAddProductModalOpen', payload: true });
    const handleAddProductModalClose = () => dispatch({ type: 'CLOSE_ADD_PRODUCT_MODAL' });
    const handleAddStoreModalOpen = () => {
        dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: false });
        dispatch({ type: 'SET_FIELD', field: 'isAddStoreModalOpen', payload: true });
    };
    const handleAddStoreModalClose = () => dispatch({ type: 'CLOSE_ADD_STORE_MODAL' });

    const handleLocationUpdate = async (e) => {
        e.preventDefault();
        if (isGuest || !selectedProduct || !userId || !db || !selectedStore) return;
        dispatch({ type: 'SET_FIELD', field: 'isUpdating', payload: true });
        const docRef = doc(db, getProductsCollectionPath(selectedStore.id), selectedProduct.id);
        try {
            await updateDoc(docRef, {
                aisle: newAisle, locationInAisle: newLocationInAisle,
                lastUpdated: serverTimestamp(), updatedBy: userId
            });
            handleUpdateModalClose();
        } catch (err) { dispatch({ type: 'SET_FIELD', field: 'error', payload: "Failed to update product location." }); }
        finally { dispatch({ type: 'SET_FIELD', field: 'isUpdating', payload: false }); }
    };

    const handleAddNewProduct = async (e) => {
        e.preventDefault();
        if (isGuest || !userId || !db || !selectedStore) return;
        const category = newProductCategory === 'Other...' ? customCategory.trim() : newProductCategory;
        if (!category) return;

        let detail = newProductQuantity ? `${newProductQuantity}` : '';
        if (newProductUnit && newProductUnit !== productUnits[0]) detail += `${detail ? ' ' : ''}${newProductUnit}`;
        const finalProductName = detail ? `${category} (${detail})` : category;

        dispatch({ type: 'SET_FIELD', field: 'isAddingProduct', payload: true });
        try {
            await addDoc(collection(db, getProductsCollectionPath(selectedStore.id)), {
                name: finalProductName, aisle: newProductAisle.trim(),
                locationInAisle: newProductLocationInAisle.trim(),
                lastUpdated: serverTimestamp(), updatedBy: userId
            });
            handleAddProductModalClose();
        } catch (err) { dispatch({ type: 'SET_FIELD', field: 'error', payload: "Failed to add new product." }); }
        finally { dispatch({ type: 'SET_FIELD', field: 'isAddingProduct', payload: false }); }
    };

    const handleAddNewStore = async (e) => {
        e.preventDefault();
        if (isGuest || !newStoreName.trim() || !newStoreAddress.trim() || !userId || !db) return;
        dispatch({ type: 'SET_FIELD', field: 'isAddingStore', payload: true });
        dispatch({ type: 'SET_FIELD', field: 'addStoreError', payload: null });
        try {
            const coords = await geocodeAddressWithGemini(newStoreAddress);
            await addDoc(collection(db, storesCollectionPath), {
                name: newStoreName.trim(), address: newStoreAddress.trim(),
                lat: coords.lat, lng: coords.lng,
            });
            handleAddStoreModalClose();
        } catch (err) {
            console.error(err);
            dispatch({ type: 'SET_FIELD', field: 'addStoreError', payload: "Could not add store. Please check the address and try again." });
        } finally {
            dispatch({ type: 'SET_FIELD', field: 'isAddingStore', payload: false });
        }
    };

    const handleAddToList = (product) => dispatch({ type: 'ADD_TO_SHOPPING_LIST', payload: product });
    const handleRemoveFromList = (productId) => dispatch({ type: 'REMOVE_FROM_SHOPPING_LIST', payload: productId });
    const handleClearList = () => dispatch({ type: 'CLEAR_SHOPPING_LIST' });
    const handleAiItemToggle = (index) => {
        dispatch({
            type: 'SET_FIELD',
            field: 'selectedAiItems',
            payload: { ...selectedAiItems, [index]: !selectedAiItems[index] }
        });
    };

    const addSelectedAiItemsToList = () => {
        const itemsToAdd = generatedItems
            .filter((_, index) => selectedAiItems[index])
            .map(item => ({
                id: crypto.randomUUID(), name: `${item.name} (${item.quantity})`,
                aisle: '?', locationInAisle: 'Location not yet specified'
            }));
        dispatch({ type: 'ADD_AI_ITEMS_TO_LIST', payload: itemsToAdd });
    };

    const addAllAiItemsToList = () => {
        const itemsToAdd = generatedItems.map(item => ({
            id: crypto.randomUUID(), name: `${item.name} (${item.quantity})`,
            aisle: '?', locationInAisle: 'Location not yet specified'
        }));
        dispatch({ type: 'ADD_AI_ITEMS_TO_LIST', payload: itemsToAdd });
    };

    const handleGoToProduct = (product) => {
        const baseName = product.name.split(' (')[0];
        dispatch({ type: 'SET_FIELD', field: 'searchTerm', payload: baseName });
        dispatch({ type: 'SET_FIELD', field: 'isListModalOpen', payload: false });
    };

    const handleSaveRecipe = async (recipeToSave) => {
        if (isGuest || !db || !userId) return;
        try { await addDoc(collection(db, getFavRecipesCollectionPath(userId)), recipeToSave); }
        catch (err) { console.error("Error saving recipe:", err); }
    };

    const handleRemoveFavourite = async (recipeId) => {
        if (isGuest || !db || !userId) return;
        try { await deleteDoc(doc(db, getFavRecipesCollectionPath(userId), recipeId)); }
        catch (err) { console.error("Error removing favourite recipe:", err); }
    };

    const handleManualAddRecipe = async (recipeData) => {
        if(isGuest || !db || !userId) return;
        try { await addDoc(collection(db, getFavRecipesCollectionPath(userId)), recipeData); }
        catch(err) { console.error("Error manually adding recipe:", err); }
    };


    const renderContent = () => {
        if (error) {
            return <div className="flex-grow flex items-center justify-center p-4"><div className="text-center p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">{error}</div></div>;
        }

        if (selectedStore) {
            return (
                <>
                    <div className="p-4 bg-gray-50 z-10 flex-shrink-0">
                        <div className="relative w-full max-w-4xl mx-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'searchTerm', payload: e.target.value })} className="w-full bg-white border-2 border-gray-300 rounded-lg py-3 pl-12 pr-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                    </div>
                    <main className="flex-grow overflow-y-auto pb-24">
                        <div className="w-full max-w-4xl mx-auto p-4 pt-0">
                            {isProductsLoading && <div className="flex justify-center items-center gap-3 p-10 text-lg text-gray-500"><LoaderCircle className="animate-spin" /><span>Loading products...</span></div>}
                            {!isProductsLoading && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredProducts.length > 0 ? ( filteredProducts.map(product => (
                                        <div key={product.id} className="bg-white rounded-xl p-5 flex flex-col justify-between shadow-md border hover:border-green-400">
                                            <div>
                                                <h2 className="text-xl font-semibold text-gray-800 mb-2">{product.name}</h2>
                                                <p className="text-green-600 text-lg font-bold mb-1"> Aisle {product.aisle || '?'} </p>
                                                <p className="text-gray-600 mb-4">{product.locationInAisle || 'No specific location'}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /><span>Updated: {formatTimestamp(product.lastUpdated)}</span></p>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2 flex justify-between items-center">
                                                <button onClick={() => handleAddToList(product)} className="flex items-center gap-1.5 bg-green-100 hover:bg-green-500 hover:text-white text-green-700 font-semibold py-2 px-3 rounded-md"> <PlusCircle size={14} /> Add to List </button>
                                                {!isGuest && <button onClick={() => handleUpdateClick(product)} className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-500 hover:text-white text-gray-700 font-semibold py-2 px-3 rounded-md"> <Edit size={14} /> Update </button>}
                                            </div>
                                        </div>
                                    ))) : (
                                        <div className="sm:col-span-2 md:col-span-3 text-center py-12 text-gray-500 flex flex-col items-center gap-4">
                                            <PackageSearch size={48} />
                                            <p className="text-lg">No products found for "{searchTerm}"</p>
                                            <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: true })} className="mt-2 flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-md">
                                                <Building2 size={16} /><span>Change Store</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>
                    {!isGuest && <button onClick={handleAddProductModalOpen} className="fixed bottom-6 right-6 z-20 flex items-center justify-center w-14 h-14 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-110"> <Plus size={28} /> </button>}
                </>
            );
        }

        return (
            <div className='flex-grow flex items-center justify-center text-center text-gray-500 p-10'>
                {isLoading ? ( <div className="flex items-center gap-3 text-lg"><LoaderCircle className="animate-spin" /><span>Loading...</span></div> )
                : ( <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: true })} className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-lg text-lg shadow-md">
                        <Store size={20} /><span>Select a Store to Begin</span>
                    </button>
                )}
            </div>
        );
    };

    if (!isAuthReady) {
         return <div className="bg-gray-50 h-screen w-screen flex items-center justify-center"><LoaderCircle className="animate-spin text-green-600" size={48} /></div>;
    }

    if (!user) {
        return <LoginScreen onGoogleSignIn={handleGoogleSignIn} onGuestSignIn={handleGuestSignIn} error={error} />;
    }

    return (
        <div className="bg-gray-50 text-gray-800 h-screen w-screen font-sans flex flex-col overflow-hidden">
            <header className="bg-white/80 backdrop-blur-sm border-b p-4 shadow-sm z-20 flex-shrink-0">
                <div className="w-full max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2"> <MapPin className="text-green-600" size={24} /> <h1 className="text-xl font-bold text-green-600">AisleFinder</h1> </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isListModalOpen', payload: true })} className='text-green-600 font-semibold flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-100 relative'>
                            <ShoppingCart size={20}/>
                            <span className="hidden sm:inline">My List</span>
                            {shoppingList.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">{shoppingList.length}</span>}
                        </button>

                        {isGuest ? (
                             <button onClick={handleSignOut} className='text-gray-600 hover:text-red-600 text-sm font-semibold flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-100'> <LogOut size={16}/> <span className="hidden sm:inline">Sign Out</span> </button>
                        ) : (
                            <div className="relative" ref={profileMenuRef}>
                                <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isProfileMenuOpen', payload: !isProfileMenuOpen })}>
                                    <img src={user.photoURL || `https://placehold.co/40x40/E2E8F0/4A5568?text=${user.displayName ? user.displayName.charAt(0) : 'U'}`} alt="User Profile" className="h-8 w-8 rounded-full" />
                                </button>
                                {isProfileMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50">
                                        {selectedStore && <button onClick={() => { dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: true }); dispatch({ type: 'SET_FIELD', field: 'isProfileMenuOpen', payload: false }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><Building2 size={16} /><span>Change Store</span></button>}
                                        <button onClick={() => { dispatch({ type: 'SET_FIELD', field: 'isFavRecipesModalOpen', payload: true }); dispatch({ type: 'SET_FIELD', field: 'isProfileMenuOpen', payload: false }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><Heart size={16} /><span>My Favourite Recipes</span></button>
                                        <button onClick={() => { dispatch({ type: 'SET_FIELD', field: 'isAddRecipeModalOpen', payload: true }); dispatch({ type: 'SET_FIELD', field: 'isProfileMenuOpen', payload: false }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><PlusSquare size={16} /><span>Add Recipe</span></button>
                                        <button onClick={() => { dispatch({ type: 'SET_FIELD', field: 'isSettingsModalOpen', payload: true }); dispatch({ type: 'SET_FIELD', field: 'isProfileMenuOpen', payload: false }); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><Settings size={16} /><span>Settings</span></button>
                                        <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><LogOut size={16} /><span>Sign Out</span></button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {selectedStore && ( <div className="w-full max-w-4xl mx-auto text-center mt-3 text-sm"> <p className="text-gray-800 font-semibold truncate">{selectedStore.name}</p> <p className='text-gray-500 truncate'>{selectedStore.address}</p> </div> )}
            </header>

            {renderContent()}

            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => dispatch({ type: 'SET_FIELD', field: 'isSettingsModalOpen', payload: false })} />
            <FavouriteRecipesModal isOpen={isFavRecipesModalOpen} onClose={() => dispatch({ type: 'SET_FIELD', field: 'isFavRecipesModalOpen', payload: false })} recipes={favouriteRecipes} onRemove={handleRemoveFavourite} />
            <AddRecipeModal isOpen={isAddRecipeModalOpen} onClose={() => dispatch({ type: 'SET_FIELD', field: 'isAddRecipeModalOpen', payload: false })} onSave={handleManualAddRecipe} />

            {isStoreModalOpen && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-2xl flex flex-col" style={{height: 'min(90vh, 700px)'}}>
                          <div className='flex justify-between items-center mb-4 flex-shrink-0'>
                              <h3 className="text-2xl font-bold text-green-600 flex items-center gap-2"><Store/> Select a Store</h3>
                              <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isStoreModalOpen', payload: false })} className="text-gray-500 hover:text-gray-800"><X /></button>
                          </div>
                          <div className='flex-shrink-0'>
                              <div className="relative mb-4">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                  <input type="text" placeholder="Search..." value={storeSearchTerm} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'storeSearchTerm', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md py-2 pl-10 pr-4 focus:ring-2 focus:ring-green-500" />
                              </div>
                              <div className='mb-4 space-y-2'>
                                  {isLocating && <div className='text-sm text-gray-500 flex items-center gap-2'><LoaderCircle className='animate-spin' size={16}/> Finding location...</div>}
                                  {locationError && <div className='text-sm text-red-600 p-2 bg-red-50 rounded-md'>{locationError}</div>}
                                  {searchLocation && (
                                      <div>
                                          <label htmlFor="radius" className="block text-sm font-medium text-gray-700 mb-2">Search Radius: <span className='font-bold text-green-600'>{searchRadius} miles</span></label>
                                          <input id='radius' type='range' min='1' max='25' value={searchRadius} onChange={e => dispatch({ type: 'SET_FIELD', field: 'searchRadius', payload: Number(e.target.value) })} className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600' />
                                      </div>
                                  )}
                                  <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isManualLocationModalOpen', payload: true })} className="text-sm text-green-600 font-semibold hover:underline">Set Location Manually</button>
                              </div>
                          </div>
                          <div className='overflow-y-auto flex-grow pr-2'>
                              {isLoading ? <div className="flex justify-center p-10"><LoaderCircle className="animate-spin" /></div> : combinedStores.length > 0 ? (
                                  <ul className='space-y-2'>
                                      {combinedStores.map(store => (
                                          <li key={store.id}>
                                              <button onClick={() => handleStoreSelect(store)} className={`w-full text-left p-4 rounded-lg border ${store.isCommunity ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                                  <p className='font-semibold'>{store.name}</p>
                                                  <p className='text-sm text-gray-600'>{store.address}</p>
                                                  {store.distance !== Infinity && <p className='text-xs text-green-600 mt-1 font-semibold'>{store.distance.toFixed(1)} miles away</p>}
                                              </button>
                                          </li>
                                      ))}
                                  </ul>
                              ) : ( <p className='text-center text-gray-500 p-6'>No stores found.</p> )}
                           </div>
                           {!isGuest && <div className='flex-shrink-0 pt-4 mt-4 border-t'>
                             <button onClick={handleAddStoreModalOpen} className='w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-green-600 hover:text-white font-bold py-3 px-4 rounded-md'> <PlusCircle size={20}/> Add New Store </button>
                           </div>}
                      </div>
                   </div>
            )}

            {isManualLocationModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isManualLocationModalOpen', payload: false })} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                        <h3 className="text-xl font-bold mb-4 text-green-600">Set Search Location</h3>
                        <form onSubmit={handleManualLocationSearch}>
                            <label htmlFor="manual-location" className="block text-sm font-medium mb-2">Enter a city or address</label>
                            <input id="manual-location" type="text" value={manualLocationInput} onChange={e => dispatch({ type: 'SET_FIELD', field: 'manualLocationInput', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5 focus:ring-2 focus:ring-green-500" placeholder="e.g., Central London" />
                            <button type="submit" disabled={isGeocoding} className="w-full mt-4 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-400">
                                {isGeocoding ? <LoaderCircle className="animate-spin" /> : 'Search'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isListModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                     <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl flex flex-col" style={{height: 'min(90vh, 800px)'}}>
                         <div className="flex justify-between items-center mb-4 flex-shrink-0">
                             <h3 className="text-2xl font-bold text-green-600 flex items-center gap-2"><ShoppingCart/> My Shopping List</h3>
                              <button onClick={() => dispatch({ type: 'SET_FIELD', field: 'isListModalOpen', payload: false })} className="text-gray-500 hover:text-gray-800"><X /></button>
                         </div>

                         <div className="grid md:grid-cols-2 gap-6 overflow-y-auto flex-grow">
                             <div className="pr-2 flex flex-col">
                                 <div>
                                     <div className="flex justify-between items-center border-b pb-2 mb-2">
                                         <h4 className="text-lg font-semibold">Your Items</h4>
                                         {shoppingList.length > 0 && (
                                             <button onClick={handleClearList} className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove All</button>
                                         )}
                                     </div>
                                     {shoppingList.length > 0 ? (
                                         <div className="space-y-4 mt-2">
                                             {Object.entries(groupedShoppingList).sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true})).map(([aisle, items]) => (
                                                 <div key={aisle}>
                                                     <h5 className="font-bold text-green-700">Aisle {aisle}</h5>
                                                     <ul className="list-disc list-inside space-y-1 mt-1">
                                                         {items.map(item => (
                                                             <li key={item.id} className="flex justify-between items-center">
                                                                 <button onClick={() => handleGoToProduct(item)} className="text-left hover:underline">{item.name}</button>
                                                                 <button onClick={() => handleRemoveFromList(item.id)} className="text-red-500 hover:text-red-700 text-xs ml-2">remove</button>
                                                             </li>
                                                         ))}
                                                     </ul>
                                                 </div>
                                             ))}
                                         </div>
                                     ) : ( <p className="text-gray-500 text-center p-4">Your list is empty.</p> )}
                                 </div>
                                 <div className="mt-auto pt-4">
                                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                          <h4 className="text-md font-semibold text-green-800 flex items-center justify-center gap-2"><Sparkles size={16}/> Create list with AI</h4>
                                          <form onSubmit={handleGenerateList} className="mt-2">
                                              <input type="text" value={aiListInput} onChange={e => dispatch({ type: 'SET_FIELD', field: 'aiListInput', payload: e.target.value })} className="w-full bg-white border rounded-md p-2" placeholder="e.g., ingredients for a BBQ" />
                                              <button type="submit" disabled={isGeneratingList} className="w-full mt-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-400">
                                                  {isGeneratingList ? <LoaderCircle className="animate-spin"/> : 'Generate List'}
                                              </button>
                                              {aiListError && <p className="text-red-500 text-xs mt-2">{aiListError}</p>}
                                          </form>
                                          {generatedItems.length > 0 && (
                                              <div className="mt-4 text-left">
                                                  <h5 className="font-semibold">AI Suggestions:</h5>
                                                  <div className="max-h-32 overflow-y-auto space-y-1 mt-1 border p-2 rounded-md bg-white">
                                                      {generatedItems.map((item, index) => (
                                                          <label key={index} className="flex items-center gap-2 p-1 rounded hover:bg-gray-100">
                                                              <input type="checkbox" checked={!!selectedAiItems[index]} onChange={() => handleAiItemToggle(index)} />
                                                              <span>{item.name} ({item.quantity})</span>
                                                          </label>
                                                      ))}
                                                  </div>
                                                  <div className="flex gap-2 mt-2">
                                                      <button onClick={addSelectedAiItemsToList} className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                                                          <ListPlus size={16}/> Add Selected
                                                      </button>
                                                       <button onClick={addAllAiItemsToList} className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md">
                                                          <ListPlus size={16}/> Add All
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                 </div>
                             </div>
                             <div className="border-t md:border-t-0 md:border-l pl-6 pt-6 md:pt-0">
                                  <h4 className="text-lg font-semibold mb-2 border-b pb-2 flex items-center gap-2"><ChefHat/> AI Recipe Corner</h4>
                                  <button onClick={handleGenerateRecipe} disabled={isGeneratingRecipe} className="w-full mt-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-400">
                                      {isGeneratingRecipe ? <LoaderCircle className="animate-spin"/> : <Sparkles/>}
                                      {isGeneratingRecipe ? 'Thinking...' : '✨ Get Recipe Ideas'}
                                  </button>

                                  {recipeError && <p className="text-red-500 text-sm mt-2">{recipeError}</p>}
                                  {isGeneratingRecipe && <div className="text-center p-8 text-gray-500">Generating a delicious idea...</div>}
                                  {recipe && (
                                      <div className="mt-4 text-sm space-y-3 animate-fade-in">
                                          <div className="flex justify-between items-start">
                                              <h5 className="font-bold text-lg text-green-700">{recipe.recipeName}</h5>
                                              {!isGuest && <button onClick={() => handleSaveRecipe(recipe)} className="flex items-center gap-1.5 bg-red-100 hover:bg-red-500 hover:text-white text-red-700 font-semibold py-1 px-2 rounded-md text-xs"><Heart size={14} /><span>Save</span></button>}
                                          </div>
                                          <p className="italic">{recipe.description}</p>
                                          <div>
                                              <h6 className="font-semibold">Ingredients you have:</h6>
                                              <ul className="list-disc list-inside">
                                                  {recipe.ingredientsUsed.map((ing, i) => <li key={i}>{ing}</li>)}
                                              </ul>
                                          </div>
                                           {recipe.missingIngredients?.length > 0 && (
                                              <div>
                                                  <h6 className="font-semibold text-orange-600">You might also need:</h6>
                                                  <ul className="list-disc list-inside">
                                                      {recipe.missingIngredients.map((ing, i) => <li key={i}>{ing}</li>)}
                                                  </ul>
                                              </div>
                                           )}
                                          <div>
                                              <h6 className="font-semibold mt-2">Instructions:</h6>
                                              <ol className="list-decimal list-inside space-y-1">
                                                   {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                              </ol>
                                          </div>
                                      </div>
                                  )}
                             </div>
                         </div>
                      </div>
                </div>
            )}

            {isAddStoreModalOpen && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                      <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl relative">
                          <button onClick={handleAddStoreModalClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                          <h3 className="text-2xl font-bold mb-6 text-green-600">Add a New Store</h3>
                          <form onSubmit={handleAddNewStore}>
                              <div className="mb-4">
                                  <label htmlFor="new-store-name" className="block text-sm font-medium mb-2">Store Name</label>
                                  <input id="new-store-name" type="text" value={newStoreName} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newStoreName', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5 focus:ring-2 focus:ring-green-500" placeholder="e.g., Asda Superstore" required />
                              </div>
                              <div className="mb-2">
                                  <label htmlFor="new-store-address" className="block text-sm font-medium mb-2">Store Address</label>
                                  <div className="flex gap-2">
                                      <input id="new-store-address" type="text" value={newStoreAddress} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newStoreAddress', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5 focus:ring-2 focus:ring-green-500" placeholder="e.g., Brighton Hill, Basingstoke" required />
                                      <button type="button" onClick={handleFindAddress} disabled={isFindingAddress || !deviceLocation} className="p-2.5 bg-green-600 text-white rounded-md hover:bg-green-500 disabled:bg-gray-400">
                                          {isFindingAddress ? <LoaderCircle className="animate-spin" /> : <LocateFixed />}
                                      </button>
                                  </div>
                              </div>
                              {addStoreError && <p className="text-red-600 text-sm mb-4 mt-2">{addStoreError}</p>}
                              <button type="submit" disabled={isAddingStore} className="w-full flex mt-6 items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md disabled:bg-gray-400">
                                  {isAddingStore ? <><LoaderCircle className="animate-spin" /> Adding...</> : <><PlusCircle size={16} /> Add Store to Map</>}
                              </button>
                          </form>
                      </div>
                   </div>
            )}

            {isAddProductModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl relative">
                        <button onClick={handleAddProductModalClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                        <h3 className="text-2xl font-bold mb-6 text-green-600">Add a New Product</h3>
                        <form onSubmit={handleAddNewProduct}>
                            <div className="mb-4">
                                <label htmlFor="new-product-category" className="block text-sm font-medium mb-2">Product Category</label>
                                <select id="new-product-category" value={newProductCategory} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newProductCategory', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5 focus:ring-2 focus:ring-green-500">
                                    {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            {newProductCategory === 'Other...' && (
                                <div className="mb-4">
                                    <label htmlFor="custom-category" className="block text-sm font-medium mb-2">Custom Category Name</label>
                                    <input id="custom-category" type="text" value={customCategory} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'customCategory', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5" placeholder="e.g., Pet Food" required />
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Size / Weight</label>
                                <div className="flex gap-2">
                                    <input type="number" value={newProductQuantity} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newProductQuantity', payload: e.target.value })} className="w-1/2 bg-gray-100 border rounded-md p-2.5" placeholder="e.g., 2" />
                                    <select value={newProductUnit} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newProductUnit', payload: e.target.value })} className="w-1/2 bg-gray-100 border rounded-md p-2.5 focus:ring-2 focus:ring-green-500">
                                        {productUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="new-product-aisle" className="block text-sm font-medium mb-2">Aisle</label>
                                <input id="new-product-aisle" type="text" value={newProductAisle} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newProductAisle', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5" placeholder="e.g., 2" />
                            </div>
                            <div className="mb-6">
                                <label htmlFor="new-product-location" className="block text-sm font-medium mb-2">Location in Aisle</label>
                                <input id="new-product-location" type="text" value={newProductLocationInAisle} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newProductLocationInAisle', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5" placeholder="e.g., Halfway down, on the left" />
                            </div>
                            <button type="submit" disabled={isAddingProduct} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md disabled:bg-gray-400">
                                {isAddingProduct ? <><LoaderCircle className="animate-spin" /> Adding...</> : <><PlusCircle size={16} /> Add Product</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isUpdateModalOpen && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl relative">
                        <button onClick={handleUpdateModalClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                        <h3 className="text-2xl font-bold mb-2 text-green-600">Update Location</h3>
                        <p className="mb-6">For: <span className="font-semibold">{selectedProduct.name}</span></p>
                        <form onSubmit={handleLocationUpdate}>
                            <div className="mb-4">
                                <label htmlFor="aisle" className="block text-sm font-medium mb-2">Aisle</label>
                                <input id="aisle" type="text" value={newAisle} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newAisle', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5" placeholder="e.g., 4" />
                            </div>
                            <div className="mb-6">
                                <label htmlFor="locationInAisle" className="block text-sm font-medium mb-2">Location in Aisle</label>
                                <input id="locationInAisle" type="text" value={newLocationInAisle} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'newLocationInAisle', payload: e.target.value })} className="w-full bg-gray-100 border rounded-md p-2.5" placeholder="e.g., Halfway down, on the left" />
                            </div>
                            <button type="submit" disabled={isUpdating} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md disabled:bg-gray-400">
                                {isUpdating ? <><LoaderCircle className="animate-spin" /> Updating...</> : <><Send size={16} /> Submit Update</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            <style>{` @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fade-in 0.3s ease-out forwards; } `}</style>
        </div>
    );
}

