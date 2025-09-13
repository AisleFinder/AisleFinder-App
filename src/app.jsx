/* global __app_id, __firebase_config */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
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
import { Search, MapPin, Edit, X, LoaderCircle, PackageSearch, Store, Building2, PlusCircle, Plus, ShoppingCart, LogOut, User, Settings, HelpCircle, Shield, FileText, Heart, Trash2, PlusSquare, ArrowRight } from 'lucide-react';

// --- Helper Functions ---
const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
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

const productCategories = [ 'Milk', 'Bread', 'Cheese', 'Eggs', 'Yogurt', 'Apples', 'Bananas', 'Tomatoes', 'Potatoes', 'Chicken', 'Beef', 'Sausages', 'Fish', 'Pasta', 'Rice', 'Cereal', 'Soup', 'Juice', 'Water', 'Fizzy Drinks', 'Crisps', 'Biscuits', 'Chocolate', 'Cleaning Spray', 'Toilet Roll', 'Shampoo', 'Other...' ];
const productUnits = [ 'Select unit', 'L', 'ml', 'kg', 'g', 'pack', 'bottle', 'can', 'loaf', 'box', 'jar' ];

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
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl border border-gray-200 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                <h3 className="text-2xl font-bold mb-6 text-green-600 flex items-center gap-2"><Settings/> Settings</h3>
                <div className="space-y-3">
                    <button type="button" className="w-full text-left flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"> <HelpCircle className="text-gray-600"/> <span className="font-semibold text-gray-700">Help & Support</span> </button>
                    <button type="button" className="w-full text-left flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"> <Shield className="text-gray-600"/> <span className="font-semibold text-gray-700">Privacy Policy</span> </button>
                    <button type="button" className="w-full text-left flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"> <FileText className="text-gray-600"/> <span className="font-semibold text-gray-700">Terms of Service</span> </button>
                </div>
            </div>
        </div>
    );
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

const StoreModal = ({ isOpen, onClose, stores, onSelect, onAddStore, isGuest }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl border border-gray-200 flex flex-col" style={{height: 'min(90vh, 800px)'}}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-green-600 flex items-center gap-2"><Store/> Select a Store</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <div className="overflow-y-auto flex-grow pr-2 space-y-3">
                    {stores.length > 0 ? stores.map(store => (
                        <button key={store.id} onClick={() => onSelect(store)} className="w-full text-left bg-gray-50 p-4 rounded-lg border-2 border-transparent hover:border-green-500 hover:bg-green-50 transition-all">
                            <h4 className="font-bold text-lg text-green-700">{store.name}</h4>
                            <p className="text-sm text-gray-600">{store.address}</p>
                            {store.distance !== Infinity && <p className="text-sm text-gray-500 font-medium mt-1">{store.distance.toFixed(1)} miles away</p>}
                        </button>
                    )) : <p className="text-center text-gray-500 p-10">No stores found.</p>}
                </div>
                {!isGuest && (
                    <div className="mt-4 flex-shrink-0 border-t pt-4">
                        <button onClick={onAddStore} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md transition-colors">
                            <PlusCircle size={20} /> Add a New Store
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const UpdateProductModal = ({ isOpen, onClose, product, onSubmit, isUpdating, aisle, setAisle, location, setLocation }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <form onSubmit={onSubmit} className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl border border-gray-200 relative space-y-4">
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                <h3 className="text-2xl font-bold mb-2 text-green-600 flex items-center gap-2"><Edit/> Update Location</h3>
                <p className="text-gray-700 font-semibold mb-6">for {product?.name}</p>
                <div>
                    <label htmlFor="aisle" className="block text-sm font-medium text-gray-700 mb-1">Aisle</label>
                    <input id="aisle" type="text" value={aisle} onChange={e => setAisle(e.target.value)} placeholder="e.g., 5 or 'Produce'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required />
                </div>
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location in Aisle (optional)</label>
                    <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., 'Middle shelf, on the right'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" />
                </div>
                <button type="submit" disabled={isUpdating} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-gray-400">
                    {isUpdating ? <LoaderCircle className="animate-spin"/> : 'Update Product'}
                </button>
            </form>
        </div>
    );
};

const AddProductModal = ({ isOpen, onClose, onSubmit, isAdding, category, setCategory, customCategory, setCustomCategory, quantity, setQuantity, unit, setUnit, aisle, setAisle, location, setLocation }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <form onSubmit={onSubmit} className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl border border-gray-200 relative space-y-4">
                 <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                 <h3 className="text-2xl font-bold mb-6 text-green-600 flex items-center gap-2"><PlusCircle/> Add a New Product</h3>
                 <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                    <select id="category" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800">
                        {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                 </div>
                 {category === 'Other...' && (
                     <div className="animate-fade-in-fast">
                        <label htmlFor="customCategory" className="block text-sm font-medium text-gray-700 mb-1">Custom Category Name</label>
                        <input id="customCategory" type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="e.g., 'Organic Tofu'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required />
                     </div>
                 )}
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity (optional)</label>
                        <input id="quantity" type="text" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g., 200" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" />
                    </div>
                    <div>
                        <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">Unit (optional)</label>
                        <select id="unit" value={unit} onChange={e => setUnit(e.target.value)} className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800">
                            {productUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                 </div>
                 <div>
                    <label htmlFor="add-aisle" className="block text-sm font-medium text-gray-700 mb-1">Aisle</label>
                    <input id="add-aisle" type="text" value={aisle} onChange={e => setAisle(e.target.value)} placeholder="e.g., 5 or 'Produce'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required />
                </div>
                <div>
                    <label htmlFor="add-location" className="block text-sm font-medium text-gray-700 mb-1">Location in Aisle (optional)</label>
                    <input id="add-location" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., 'Middle shelf, on the right'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" />
                </div>
                 <button type="submit" disabled={isAdding} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-gray-400">
                    {isAdding ? <LoaderCircle className="animate-spin"/> : 'Add Product'}
                </button>
            </form>
        </div>
    );
};

const AddStoreModal = ({ isOpen, onClose, onSubmit, isAdding, name, setName, address, setAddress }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <form onSubmit={onSubmit} className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl border border-gray-200 relative space-y-4">
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X /></button>
                <h3 className="text-2xl font-bold mb-6 text-green-600 flex items-center gap-2"><Building2/> Add a New Store</h3>
                <div>
                    <label htmlFor="store-name" className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                    <input id="store-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., 'Tesco Superstore'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required />
                </div>
                <div>
                    <label htmlFor="store-address" className="block text-sm font-medium text-gray-700 mb-1">Store Address</label>
                    <input id="store-address" type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g., '123 High Street, London'" className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-gray-800" required />
                </div>
                <button type="submit" disabled={isAdding} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-gray-400">
                    {isAdding ? <LoaderCircle className="animate-spin"/> : 'Add Store'}
                </button>
            </form>
        </div>
    );
};

const ShoppingListModal = ({ isOpen, onClose, list, onRemove, onGoToProduct, onGenerateList, isGeneratingList, aiListInput, setAiListInput, generatedItems, onAddAllAiItems }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl border border-gray-200 flex flex-col" style={{height: 'min(90vh, 800px)'}}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-green-600 flex items-center gap-2"><ShoppingCart/> Shopping List</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Generate list from recipe or idea</h4>
                    <form onSubmit={onGenerateList} className="flex gap-2">
                        <input 
                            type="text" 
                            value={aiListInput}
                            onChange={(e) => setAiListInput(e.target.value)}
                            placeholder="e.g., 'Ingredients for lasagna'" 
                            className="flex-grow bg-white border border-gray-300 rounded-md p-2 text-gray-800"
                            disabled={isGeneratingList}
                        />
                        <button type="submit" className="bg-green-600 hover:bg-green-500 text-white font-bold p-2 rounded-md disabled:bg-gray-400" disabled={isGeneratingList}>
                           {isGeneratingList ? <LoaderCircle className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                        </button>
                    </form>
                    {generatedItems.length > 0 && (
                        <div className="mt-3 animate-fade-in-fast">
                            <ul className="space-y-1 text-sm text-gray-700">
                                {generatedItems.map(item => <li key={item.name}>- {item.name} ({item.quantity})</li>)}
                            </ul>
                            <button onClick={onAddAllAiItems} className="mt-2 text-sm bg-green-100 hover:bg-green-200 text-green-800 font-semibold py-1 px-3 rounded-md">Add All to List</button>
                        </div>
                    )}
                </div>

                <div className="overflow-y-auto flex-grow pr-2">
                    {list.length > 0 ? (
                        <div className="space-y-2">
                            {list.map(item => (
                                <div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-800">{item.name}</p>
                                        <p className="text-sm text-gray-500">Aisle {item.aisle || '?'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onGoToProduct(item)} className="text-green-600 hover:text-green-800"><Search size={18}/></button>
                                        <button onClick={() => onRemove(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 p-10">Your shopping list is empty.</p>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'aisle-finder-default';

    // Store state
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

    // Product state
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProductsLoading, setIsProductsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Update Product Modal state
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [newAisle, setNewAisle] = useState('');
    const [newLocationInAisle, setNewLocationInAisle] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Add Product Modal state
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [newProductCategory, setNewProductCategory] = useState(productCategories[0]);
    const [customCategory, setCustomCategory] = useState('');
    const [newProductQuantity, setNewProductQuantity] = useState('');
    const [newProductUnit, setNewProductUnit] = useState(productUnits[0]);
    const [newProductAisle, setNewProductAisle] = useState('');
    const [newProductLocationInAisle, setNewProductLocationInAisle] = useState('');
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    
    // Add Store Modal state
    const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreAddress, setNewStoreAddress] = useState('');
    const [isAddingStore, setIsAddingStore] = useState(false);
    
    // Location state
    const [, setDeviceLocation] = useState(null); 
    const [searchLocation, setSearchLocation] = useState(null); 

    // Shopping List State
    const [shoppingList, setShoppingList] = useState([]);
    const [isListModalOpen, setIsListModalOpen] = useState(false);

    // Gemini Recipe State
    const [favouriteRecipes, setFavouriteRecipes] = useState([]);
    const [isFavRecipesModalOpen, setIsFavRecipesModalOpen] = useState(false);
    
    // Gemini List Generator State
    const [aiListInput, setAiListInput] = useState('');
    const [generatedItems, setGeneratedItems] = useState([]);
    const [isGeneratingList, setIsGeneratingList] = useState(false);


    // --- Firebase Initialization Effect ---
    useEffect(() => {
        try {
            const firebaseConfig = typeof __firebase_config !== 'undefined'
                ? JSON.parse(__firebase_config)
                : {
                    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
                    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
                    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
                    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
                    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
                    appId: process.env.REACT_APP_FIREBASE_APP_ID,
                };

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                setUser(user);
                setIsGuest(user ? user.isAnonymous : false);
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase initialization error:", e);
            setError("Firebase configuration is missing or invalid.");
            setIsLoading(false);
            setIsAuthReady(true);
        }
    }, []);

    // --- Geolocation Effect ---
    useEffect(() => {
        if (navigator.geolocation) {
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setDeviceLocation(location);
                    setSearchLocation(location); 
                },
                (error) => {
                    console.error("Geolocation error:", error.code, error.message);
                },
                options
            );
        }
    }, []);

    // --- Fetch Stores Effect ---
    useEffect(() => {
        if (!db || !isAuthReady || !user) {
            return;
        }

        const storesCollectionPath = `artifacts/${appId}/public/data/stores`;
        const storesRef = collection(db, storesCollectionPath);

        const unsubscribe = onSnapshot(storesRef, (snapshot) => {
            const storesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isCommunity: true }));
            setStores(storesData);
            if (!selectedStore && user) {
                setIsStoreModalOpen(true);
            }
            setIsLoading(false);
        }, (err) => {
            console.error("Firestore error:", err);
            setError("Could not fetch store data. Check Firestore rules and collection path.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, user, selectedStore, appId]);
    
    // --- Product Fetching Effect ---
    useEffect(() => {
        if (!db || !isAuthReady || !selectedStore || !selectedStore.isCommunity) {
            setProducts([]);
            return;
        }
        setIsProductsLoading(true);
        const productsCollectionPath = `artifacts/${appId}/public/data/stores/${selectedStore.id}/products`;
        const unsubscribe = onSnapshot(collection(db, productsCollectionPath), (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            productsData.sort((a, b) => a.name.localeCompare(b.name));
            setProducts(productsData);
            setIsProductsLoading(false);
        }, (err) => {
            setError(`Could not fetch product data for ${selectedStore.name}.`);
            setIsProductsLoading(false);
        });
        return () => unsubscribe();
    }, [db, isAuthReady, selectedStore, appId]);
    
    // --- Fetch Favourite Recipes Effect ---
    useEffect(() => {
        if (db && user && !isGuest) {
            const favRecipesCollectionPath = `artifacts/${appId}/users/${user.uid}/favouriteRecipes`;
            const unsubscribe = onSnapshot(collection(db, favRecipesCollectionPath), (snapshot) => {
                const favs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setFavouriteRecipes(favs);
            });
            return () => unsubscribe();
        }
    }, [db, user, isGuest, appId]);
    
    // --- Effect to close dropdown on outside click ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [profileMenuRef]);
    
    // --- Effect for Content Security Policy ---
    useEffect(() => {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Security-Policy');
        meta.setAttribute('content', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://apis.google.com https://www.gstatic.com https://www.googleapis.com https://accounts.google.com https://firebaseapp.com https://firebase.googleapis.com https://vercel.live https://maps.googleapis.com https://securetoken.googleapis.com https://generativelanguage.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://lh3.googleusercontent.com https://placehold.co https://www.google.com https://maps.gstatic.com https://maps.googleapis.com; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://generativelanguage.googleapis.com https://apis.google.com https://maps.googleapis.com https://accounts.google.com https://securetoken.googleapis.com https://googleapis.com https://vercel.live; frame-src 'self' https://supermarket-product-find-b6413.firebaseapp.com https://accounts.google.com;");
        document.head.appendChild(meta);

        return () => {
            document.head.removeChild(meta);
        };
    }, []);


    // --- Memoized Filtering ---
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, products]);
    
    const combinedStores = useMemo(() => {
        const allStores = [...stores];
        
        let storesWithDistance = allStores.map(store => {
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

        return storesWithDistance;
    }, [stores, searchLocation]);

    // --- API Calls ---
    const geocodeAddress = async (address) => {
        // This function requires a Google Maps Geocoding API key.
        // For the purpose of this example, it will return a mock location.
        console.log(`Geocoding address: ${address}`);
        return { lat: 34.0522, lng: -118.2437 }; // Mock Los Angeles location
    };

     const handleGenerateList = async (e) => {
        e.preventDefault();
        if (!aiListInput.trim()) return;
        
        setIsGeneratingList(true);
        setGeneratedItems([]);

        // This function requires a Gemini API key.
        console.log(`Generating list for: "${aiListInput}"`);
        // Mock response
        const mockItems = [{name: "Milk", quantity: "1 gallon"}, {name: "Bread", quantity: "1 loaf"}, {name: "Eggs", quantity: "1 dozen"}];
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        setGeneratedItems(mockItems);
        setIsGeneratingList(false);
    };
    

    // --- Authentication Handlers ---
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            setError("Could not sign in with Google. Please try again.");
        }
    };

    const handleGuestSignIn = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Guest Sign-In Error:", error);
            setError("Could not sign in as a guest. Please try again.");
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };


    // --- Event Handlers ---
    const handleStoreSelect = (store) => {
        setSelectedStore(store);
        setIsStoreModalOpen(false);
    };
    
    const handleUpdateClick = (product) => { 
        setSelectedProduct(product); 
        setNewAisle(product.aisle || ''); 
        setNewLocationInAisle(product.locationInAisle || ''); 
        setIsUpdateModalOpen(true); 
    };

    const handleUpdateModalClose = () => { 
        setIsUpdateModalOpen(false); 
        setSelectedProduct(null); 
        setNewAisle(''); 
        setNewLocationInAisle(''); 
        setIsUpdating(false);
    };

    const handleAddProductModalOpen = () => { setIsAddProductModalOpen(true); };
    
    const handleAddProductModalClose = () => { 
        setIsAddProductModalOpen(false);
        setNewProductCategory(productCategories[0]);
        setCustomCategory('');
        setNewProductQuantity('');
        setNewProductUnit(productUnits[0]);
        setNewProductAisle(''); 
        setNewProductLocationInAisle(''); 
        setIsAddingProduct(false); 
    };
    
    const handleAddStoreModalOpen = () => {
        setIsStoreModalOpen(false);
        setIsAddStoreModalOpen(true);
    };
    
    const handleAddStoreModalClose = () => { 
        setIsAddStoreModalOpen(false);
        setNewStoreName('');
        setNewStoreAddress('');
    };

    const handleLocationUpdate = async (e) => {
        e.preventDefault();
        if (isGuest) return;
        if (!selectedProduct || !user.uid || !db || !selectedStore) return;
        setIsUpdating(true);
        const docRef = doc(db, `artifacts/${appId}/public/data/stores/${selectedStore.id}/products`, selectedProduct.id);
        try {
            await updateDoc(docRef, { 
                aisle: newAisle, 
                locationInAisle: newLocationInAisle, 
                lastUpdated: serverTimestamp(), 
                updatedBy: user.uid 
            });
            handleUpdateModalClose();
        } catch (err) { setError("Failed to update product location."); } 
        finally { setIsUpdating(false); }
    };
    
    const handleAddNewProduct = async (e) => {
        e.preventDefault();
        if (isGuest) return;
        
        const category = newProductCategory === 'Other...' ? customCategory.trim() : newProductCategory;
        if (!category || !user.uid || !db || !selectedStore) return;

        let detail = '';
        if (newProductQuantity) {
            detail += newProductQuantity;
        }
        if (newProductUnit && newProductUnit !== productUnits[0]) {
            detail += (detail ? ' ' : '') + newProductUnit;
        }

        const finalProductName = detail ? `${category} (${detail})` : category;

        setIsAddingProduct(true);
        const productsCollectionRef = collection(db, `artifacts/${appId}/public/data/stores/${selectedStore.id}/products`);
        
        try {
            await addDoc(productsCollectionRef, { 
                name: finalProductName,
                aisle: newProductAisle.trim(), 
                locationInAisle: newProductLocationInAisle.trim(), 
                lastUpdated: serverTimestamp(), 
                updatedBy: user.uid 
            });
            handleAddProductModalClose();
        } catch (err) { 
            setError("Failed to add new product."); 
        } finally { 
            setIsAddingProduct(false); 
        }
    };
    
    const handleAddNewStore = async (e) => {
        e.preventDefault();
        if (isGuest) return;
        if (!newStoreName.trim() || !newStoreAddress.trim() || !user.uid || !db) return;
        setIsAddingStore(true);
        try {
            const coords = await geocodeAddress(newStoreAddress);
            const storesCollectionRef = collection(db, `artifacts/${appId}/public/data/stores`);
            await addDoc(storesCollectionRef, { 
                name: newStoreName.trim(), 
                address: newStoreAddress.trim(), 
                lat: coords.lat, 
                lng: coords.lng,
            });
            handleAddStoreModalClose();
            setIsStoreModalOpen(true); // Re-open the store modal to see the new store
        } catch (err) {
            console.error(err);
            setError("Failed to add new store.");
        } finally {
            setIsAddingStore(false);
        }
    };

    const handleAddToList = (product) => {
        setShoppingList(prevList => {
            if (prevList.find(item => item.id === product.id)) {
                return prevList;
            }
            return [...prevList, product];
        });
    };
    
    const handleRemoveFromList = (productId) => {
        setShoppingList(prevList => prevList.filter(item => item.id !== productId));
    };
    
    const addAllAiItemsToList = () => {
        const itemsToAdd = generatedItems.map(item => ({
            id: crypto.randomUUID(),
            name: `${item.name} (${item.quantity})`,
            aisle: '?',
            locationInAisle: 'Location not yet specified'
        }));

        setShoppingList(prev => [...prev, ...itemsToAdd]);
        setGeneratedItems([]);
        setAiListInput('');
    };
    
    const handleGoToProduct = (product) => {
        const baseName = product.name.split(' (')[0]; 
        setSearchTerm(baseName);
        setIsListModalOpen(false);
    };

    const handleRemoveFavourite = async (recipeId) => {
        if (isGuest || !db || !user) return;
        const favRecipeDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/favouriteRecipes/${recipeId}`);
        try {
            await deleteDoc(favRecipeDocRef);
        } catch (err) {
            console.error("Error removing favourite recipe:", err);
        }
    };

    const handleManualAddRecipe = async (recipeData) => {
        if(isGuest || !db || !user) return;
        const favRecipesCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/favouriteRecipes`);
        try {
            await addDoc(favRecipesCollectionRef, recipeData);
        } catch(err) {
            console.error("Error manually adding recipe:", err);
        }
    };


    const renderContent = () => {
        if (error) {
            return (
                <div className="flex-grow flex items-center justify-center p-4">
                    <div className="text-center p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">{error}</div>
                </div>
            );
        }

        if (selectedStore) {
            return (
                <>
                    <div className="p-4 bg-gray-50 z-10 flex-shrink-0">
                        <div className="relative w-full max-w-4xl mx-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border-2 border-gray-300 rounded-lg py-3 pl-12 pr-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all" />
                        </div>
                    </div>
                    <main className="flex-grow overflow-y-auto pb-24">
                        <div className="w-full max-w-4xl mx-auto p-4 pt-0">
                            {isProductsLoading && <div className="flex justify-center items-center gap-3 p-10 text-lg text-gray-500"><LoaderCircle className="animate-spin" /><span>Loading products...</span></div>}
                            {!isProductsLoading && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredProducts.length > 0 ? ( filteredProducts.map(product => (
                                        <div key={product.id} className="bg-white rounded-xl p-5 flex flex-col justify-between shadow-md border border-gray-200 hover:border-green-400 transition-colors duration-300">
                                            <div>
                                                <h2 className="text-xl font-semibold text-gray-800 mb-2">{product.name}</h2>
                                                <p className="text-green-600 text-lg font-bold mb-1"> Aisle {product.aisle || '?'} </p>
                                                <p className="text-gray-600 mb-4">{product.locationInAisle || 'No specific location given'}</p>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2 flex justify-between items-center">
                                                <button onClick={() => handleAddToList(product)} className="flex items-center gap-1.5 bg-green-100 hover:bg-green-500 hover:text-white text-green-700 font-semibold py-2 px-3 rounded-md transition-colors text-xs"> <PlusCircle size={14} /> Add to List </button>
                                                {!isGuest && <button onClick={() => handleUpdateClick(product)} className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-500 hover:text-white text-gray-700 font-semibold py-2 px-3 rounded-md transition-colors text-xs"> <Edit size={14} /> Update </button>}
                                            </div>
                                        </div>
                                    ))) : (
                                        <div className="sm:col-span-2 md:col-span-3 text-center py-12 text-gray-500 flex flex-col items-center gap-4">
                                            <PackageSearch size={48} />
                                            <p className="text-lg">No products found for "{searchTerm}"</p>
                                            <button
                                                onClick={() => setIsStoreModalOpen(true)}
                                                className="mt-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-md transition-colors"
                                            >
                                                <Building2 size={16} />
                                                <span>Change Store</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>
                    {!isGuest && <button onClick={handleAddProductModalOpen} className="fixed bottom-6 right-6 z-20 flex items-center justify-center w-14 h-14 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-110" aria-label="Add New Product"> <Plus size={28} /> </button>}
                </>
            );
        }

        return (
            <div className='flex-grow flex items-center justify-center text-center text-gray-500 p-10'>
                {isLoading || !isAuthReady ? (
                    <div className="flex items-center gap-3 text-lg"><LoaderCircle className="animate-spin" /><span>Loading...</span></div>
                ) : (
                     <button
                         onClick={() => setIsStoreModalOpen(true)}
                         className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-lg transition-colors text-lg shadow-md"
                     >
                         <Store size={20} />
                         <span>Select a Store to Begin</span>
                     </button>
                )}
            </div>
        );
    };

    // --- Render Logic ---
    if (!isAuthReady) {
         return (
            <div className="bg-gray-50 h-screen w-screen flex items-center justify-center">
                <LoaderCircle className="animate-spin text-green-600" size={48} />
            </div>
        );
    }
    
    if (!user) {
        return <LoginScreen onGoogleSignIn={handleGoogleSignIn} onGuestSignIn={handleGuestSignIn} error={error} />;
    }

    return (
        <div className="bg-gray-50 text-gray-800 h-screen w-screen font-sans flex flex-col overflow-hidden">
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4 shadow-sm z-20 flex-shrink-0">
                <div className="w-full max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <MapPin className="text-green-600" size={24} />
                        <h1 className="text-xl font-bold text-green-600">AisleFinder</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {selectedStore && (
                            <button 
                                onClick={() => setIsStoreModalOpen(true)} 
                                className="hidden sm:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-green-600 transition-colors"
                            >
                                <Store size={16} />
                                <span>{selectedStore.name}</span>
                            </button>
                        )}
                         <button
                            onClick={() => setIsListModalOpen(true)}
                            className="relative"
                        >
                            <ShoppingCart className="text-gray-600 hover:text-green-600" />
                            {shoppingList.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {shoppingList.length}
                                </span>
                            )}
                        </button>
                        <div className="relative" ref={profileMenuRef}>
                            <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center gap-2">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-transparent hover:border-green-500 transition" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center border-2 border-transparent hover:border-green-500 transition">
                                        <User className="text-gray-600" />
                                    </div>
                                )}
                            </button>
                            {isProfileMenuOpen && (
                                <div className="animate-fade-in-fast absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-2 z-50 border border-gray-200">
                                    <div className="px-4 py-2 border-b">
                                        <p className="text-sm font-semibold text-gray-800">{user.displayName || 'User'}</p>
                                        <p className="text-xs text-gray-500">{isGuest ? 'Guest Account' : user.email}</p>
                                    </div>
                                    <button onClick={() => { setIsFavRecipesModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"> <Heart size={16}/> Favourite Recipes </button>
                                    <button onClick={() => { setIsAddRecipeModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"> <PlusSquare size={16}/> Add Recipe </button>
                                    <button onClick={() => { setIsSettingsModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"> <Settings size={16}/> Settings </button>
                                    <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"> <LogOut size={16}/> Sign Out </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {renderContent()}

            {/* --- Modals --- */}
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
            <FavouriteRecipesModal isOpen={isFavRecipesModalOpen} onClose={() => setIsFavRecipesModalOpen(false)} recipes={favouriteRecipes} onRemove={handleRemoveFavourite} />
            <AddRecipeModal isOpen={isAddRecipeModalOpen} onClose={() => setIsAddRecipeModalOpen(false)} onSave={handleManualAddRecipe}/>
            <StoreModal 
                isOpen={isStoreModalOpen}
                onClose={() => setIsStoreModalOpen(false)}
                stores={combinedStores}
                onSelect={handleStoreSelect}
                onAddStore={handleAddStoreModalOpen}
                isGuest={isGuest}
            />
            <UpdateProductModal 
                isOpen={isUpdateModalOpen}
                onClose={handleUpdateModalClose}
                product={selectedProduct}
                onSubmit={handleLocationUpdate}
                isUpdating={isUpdating}
                aisle={newAisle}
                setAisle={setNewAisle}
                location={newLocationInAisle}
                setLocation={setNewLocationInAisle}
            />
            <AddProductModal 
                isOpen={isAddProductModalOpen}
                onClose={handleAddProductModalClose}
                onSubmit={handleAddNewProduct}
                isAdding={isAddingProduct}
                category={newProductCategory}
                setCategory={setNewProductCategory}
                customCategory={customCategory}
                setCustomCategory={setCustomCategory}
                quantity={newProductQuantity}
                setQuantity={setNewProductQuantity}
                unit={newProductUnit}
                setUnit={setNewProductUnit}
                aisle={newProductAisle}
                setAisle={setNewProductAisle}
                location={newProductLocationInAisle}
                setLocation={setNewProductLocationInAisle}
            />
            <AddStoreModal 
                isOpen={isAddStoreModalOpen}
                onClose={handleAddStoreModalClose}
                onSubmit={handleAddNewStore}
                isAdding={isAddingStore}
                name={newStoreName}
                setName={setNewStoreName}
                address={newStoreAddress}
                setAddress={setNewStoreAddress}
            />
            <ShoppingListModal
                isOpen={isListModalOpen}
                onClose={() => setIsListModalOpen(false)}
                list={shoppingList}
                onRemove={handleRemoveFromList}
                onGoToProduct={handleGoToProduct}
                onGenerateList={handleGenerateList}
                isGeneratingList={isGeneratingList}
                aiListInput={aiListInput}
                setAiListInput={setAiListInput}
                generatedItems={generatedItems}
                onAddAllAiItems={addAllAiItemsToList}
            />
        </div>
    );
}

