import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, Star, Target, TrendingUp, Users, Award, Copy, Link } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, get } from 'firebase/database';

// REPLACE THIS WITH YOUR FIREBASE CONFIG FROM STEP 1.3
const firebaseConfig = {
  apiKey: "AIzaSyAgVVmCiipVGZdT-KxKSBFUpjBO3x9Th1s",
  authDomain: "shark-tank-voting.firebaseapp.com",
  databaseURL: "https://shark-tank-voting-default-rtdb.firebaseio.com",
  projectId: "shark-tank-voting",
  storageBucket: "shark-tank-voting.firebasestorage.app",
  messagingSenderId: "368502305847",
  appId: "1:368502305847:web:47e3aff46733312ed6fbb2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Context for app state
const AppContext = createContext();

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// Sample pitches data based on the provided image
const samplePitches = [
  {
    id: 1,
    title: "AI Integration for Payroll",
    presenter: "Juane",
    description: "AI that can transform any employee data for data migrations and integration in a fraction of the traditional time."
  },
  {
    id: 2,
    title: "Test Case Automation",
    presenter: "Jhani",
    description: "GenAI and ML to automate test case creation, validation, and simulation of real-world payroll scenarios."
  },
  {
    id: 3,
    title: "Payroll Variance Explanation",
    presenter: "Jan",
    description: "Explain payroll variances, saving payroll analysts massive amounts of time."
  },
  {
    id: 4,
    title: "SAP Joule",
    presenter: "Imran",
    description: "Chatbot to explain paysatements or develop custom agents for SAP."
  },
  {
    id: 5,
    title: "Payroll Legal Watch Agent",
    presenter: "Andrich and Arne",
    description: "AI that scans for updated legislation and compliance requirements."
  },
  {
    id: 6,
    title: "Grant Automation",
    presenter: "Chris",
    description: "AI that help complete complex grant requests for MIT. Can be adopted to respond to RFPs."
  },
  {
    id: 7,
    title: "System42",
    presenter: "Anrich/Arne",
    description: "Platform for AI agents."
  },
  {
    id: 8,
    title: "AI Roadmapping",
    presenter: "Jan",
    description: "Service to help clients create a strategic roadmap for payroll AI deployment."
  }
];


// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const AppProvider = ({ children, sessionId }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPitchIndex, setCurrentPitchIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [investments, setInvestments] = useState({});
  const [allParticipants, setAllParticipants] = useState([]);
  const [sessionExists, setSessionExists] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionPitches, setSessionPitches] = useState(samplePitches);
  
  const TOTAL_BUDGET = 10000;

  // Initialize session and listen for updates
  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const initSession = async () => {
      try {
        const sessionRef = ref(db, `sessions/${sessionId}`);
        const snapshot = await get(sessionRef);
        if (!snapshot.exists()) {
          setSessionExists(false);
          setIsLoading(false);
          return;
        }

        const sessionData = snapshot.val();
        setSessionPitches(sessionData.pitches || samplePitches);
        setSessionExists(true);
        setIsLoading(false);

        const ratingsRef = ref(db, `sessions/${sessionId}/ratings`);
        const investmentsRef = ref(db, `sessions/${sessionId}/investments`);
        const usersRef = ref(db, `sessions/${sessionId}/users`);

        const unsubRatings = onValue(ratingsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) setRatings(data);
        });

        const unsubInvestments = onValue(investmentsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) setInvestments(data);
        });

        const unsubUsers = onValue(usersRef, (snapshot) => {
          const data = snapshot.val();
          if (data) setAllParticipants(Object.values(data));
        });

        return () => {
          unsubRatings();
          unsubInvestments();
          unsubUsers();
        };
      } catch (error) {
        console.error('Error initializing session:', error);
        setSessionExists(false);
        setIsLoading(false);
      }
    };

    initSession();
  }, [sessionId]);

  const login = async (name) => {
    const user = { id: Date.now(), name, joinedAt: new Date().toISOString() };
    setCurrentUser(user);
    
    if (sessionId) {
      await set(ref(db, `sessions/${sessionId}/users/${user.id}`), user);
    }
  };

  const updateRating = useMemo(
    () => debounce(async (pitchId, category, value) => {
      if (!currentUser || !sessionId) return;
      
      await set(
        ref(db, `sessions/${sessionId}/ratings/${currentUser.id}/${pitchId}/${category}`),
        value
      );
    }, 300),
    [currentUser, sessionId]
  );

  const updateInvestment = async (pitchId, amount) => {
    if (!currentUser || !sessionId) return false;
    
    const currentInvestments = investments[currentUser.id] || {};
    const totalInvested = Object.entries(currentInvestments)
      .filter(([id]) => id !== pitchId.toString())
      .reduce((sum, [, amt]) => sum + amt, 0);
    
    if (totalInvested + amount > TOTAL_BUDGET) {
      // Using a custom modal/alert would be better, but for now, we prevent the action.
      console.warn(`Cannot invest $${amount}. You only have $${TOTAL_BUDGET - totalInvested} remaining.`);
      return false;
    }

    await set(
      ref(db, `sessions/${sessionId}/investments/${currentUser.id}/${pitchId}`),
      amount
    );
    return true;
  };

  const createSession = async (pitches = samplePitches) => {
    const newSessionRef = push(ref(db, 'sessions'));
    const sessionId = newSessionRef.key;
    await set(newSessionRef, {
      createdAt: new Date().toISOString(),
      pitches: pitches
    });
    return sessionId;
  };

  const getTotalInvested = () => {
    if (!currentUser) return 0;
    const userInvestments = investments[currentUser.id] || {};
    return Object.values(userInvestments).reduce((sum, amt) => sum + amt, 0);
  };

  const getRemainingBudget = () => {
    return TOTAL_BUDGET - getTotalInvested();
  };

  const getAggregatedResults = () => {
    return sessionPitches.map(pitch => {
      let totalCoolness = 0, totalRelevance = 0, totalInvestment = 0;
      let ratingCount = 0, investorCount = 0;

      Object.entries(ratings).forEach(([userId, userRatings]) => {
        if (userRatings[pitch.id]) {
          if (userRatings[pitch.id].coolness) {
            totalCoolness += userRatings[pitch.id].coolness;
            ratingCount++;
          }
          if (userRatings[pitch.id].relevance) {
            totalRelevance += userRatings[pitch.id].relevance;
          }
        }
      });

      Object.entries(investments).forEach(([userId, userInvestments]) => {
        if (userInvestments[pitch.id] && userInvestments[pitch.id] > 0) {
          totalInvestment += userInvestments[pitch.id];
          investorCount++;
        }
      });

      const avgCoolness = ratingCount > 0 ? totalCoolness / ratingCount : 0;
      const avgRelevance = ratingCount > 0 ? totalRelevance / ratingCount : 0;
      
      const maxPossibleInvestment = allParticipants.length * TOTAL_BUDGET;
      const normalizedInvestment = maxPossibleInvestment > 0 ? (totalInvestment / maxPossibleInvestment) * 10 : 0;
      const overallScore = (avgCoolness * 0.3) + (avgRelevance * 0.3) + (normalizedInvestment * 0.4);

      return {
        ...pitch,
        avgCoolness,
        avgRelevance,
        totalInvestment,
        investorCount,
        overallScore
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      login,
      currentPitchIndex,
      setCurrentPitchIndex,
      ratings,
      updateRating,
      investments,
      updateInvestment,
      getTotalInvested,
      getRemainingBudget,
      getAggregatedResults,
      allParticipants,
      TOTAL_BUDGET,
      sessionId,
      createSession,
      sessionExists,
      isLoading,
      sessionPitches
    }}>
      {children}
    </AppContext.Provider>
  );
};

// Session Creation Component
const CreateSession = () => {
  const { createSession } = useApp();
  const [isCreating, setIsCreating] = useState(false);
  const [showPitchSetup, setShowPitchSetup] = useState(false);
  const [customPitches, setCustomPitches] = useState(samplePitches);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const newSessionId = await createSession(customPitches);
      const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${newSessionId}`;
      window.location.href = sessionUrl;
    } catch (error) {
      console.error('Error creating session:', error);
      // Using console.error instead of alert
    }
    setIsCreating(false);
  };

  const updatePitch = (index, field, value) => {
    const updated = [...customPitches];
    updated[index] = { ...updated[index], [field]: value };
    setCustomPitches(updated);
  };

  const addPitch = () => {
    const newPitch = {
      id: customPitches.length > 0 ? Math.max(...customPitches.map(p => p.id)) + 1 : 1,
      title: "New Pitch",
      presenter: "Presenter Name",
      description: "Pitch description"
    };
    setCustomPitches([...customPitches, newPitch]);
  };

  const removePitch = (index) => {
    if (customPitches.length > 1) {
      const updated = customPitches.filter((_, i) => i !== index);
      setCustomPitches(updated);
    }
  };

  if (showPitchSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Configure Pitches</h1>
            <p className="text-gray-600 mb-6">Set up the pitches for your Shark Tank session</p>
            
            <div className="space-y-4 mb-6">
              {customPitches.map((pitch, index) => (
                <div key={pitch.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg">Pitch {index + 1}</h3>
                    {customPitches.length > 1 && (
                      <button
                        onClick={() => removePitch(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pitch Title
                      </label>
                      <input
                        type="text"
                        value={pitch.title}
                        onChange={(e) => updatePitch(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Presenter Name
                      </label>
                      <input
                        type="text"
                        value={pitch.presenter}
                        onChange={(e) => updatePitch(index, 'presenter', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={pitch.description}
                        onChange={(e) => updatePitch(index, 'description', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={addPitch}
              className="mb-6 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-200"
            >
              + Add Another Pitch
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowPitchSetup(false)}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition duration-200"
              >
                Back
              </button>
              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition duration-200"
              >
                {isCreating ? 'Creating session...' : 'Start Session'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Shark Tank Voting</h1>
        <p className="text-gray-600 mb-8">Create a session or join an existing one</p>
        
        <button
          onClick={() => setShowPitchSetup(true)}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 flex items-center justify-center mb-3"
        >
          <Link className="w-5 h-5 mr-2" />
          Create New Session
        </button>
        
        <button
          onClick={() => handleCreateSession()}
          className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition duration-200 text-sm"
        >
          Quick Start (Use Default Pitches)
        </button>
        
        <div className="mt-6 text-sm text-gray-600">
          <p>Once created, share the session URL with all participants</p>
        </div>
      </div>
    </div>
  );
};

// Login Component
const Login = () => {
  const [name, setName] = useState('');
  const { login, sessionId } = useApp();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      login(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Shark Tank Voting</h1>
        <p className="text-gray-600 mb-6">
          {sessionId ? 'Enter your name to join the session' : 'Create or join a session to begin'}
        </p>
        
        {sessionId && (
          <>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                autoFocus
              />
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200"
              >
                Join Session
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                You'll receive <span className="font-bold text-green-600">${'10,000'}</span> to invest
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Pitch Voting Component
const PitchVoting = () => {
  const {
    currentPitchIndex,
    setCurrentPitchIndex,
    ratings,
    investments,
    updateRating,
    updateInvestment,
    currentUser,
    getRemainingBudget,
    sessionPitches
  } = useApp();
  
  const currentPitch = sessionPitches[currentPitchIndex];
  const userRatings = ratings[currentUser.id]?.[currentPitch.id] || {};
  const userInvestment = investments[currentUser.id]?.[currentPitch.id] || 0;
  
  const [coolness, setCoolness] = useState(userRatings.coolness || 5);
  const [relevance, setRelevance] = useState(userRatings.relevance || 5);
  const [investmentAmount, setInvestmentAmount] = useState(userInvestment || '');

  useEffect(() => {
    const updatedUserRatings = ratings[currentUser.id]?.[currentPitch.id] || {};
    const updatedUserInvestment = investments[currentUser.id]?.[currentPitch.id] || 0;
    setCoolness(updatedUserRatings.coolness || 5);
    setRelevance(updatedUserRatings.relevance || 5);
    setInvestmentAmount(updatedUserInvestment || '');
  }, [currentPitchIndex, currentPitch.id, ratings, investments, currentUser.id]);

  const handleCoolnessChange = (value) => {
    setCoolness(value);
    updateRating(currentPitch.id, 'coolness', parseInt(value));
  };

  const handleRelevanceChange = (value) => {
    setRelevance(value);
    updateRating(currentPitch.id, 'relevance', parseInt(value));
  };

  const handleInvestmentChange = (value) => {
    if (value === '') {
      setInvestmentAmount('');
      updateInvestment(currentPitch.id, 0);
      return;
    }
    
    const cleanValue = value.replace(/[^\d]/g, '');
    
    if (cleanValue === '') {
      setInvestmentAmount('');
      updateInvestment(currentPitch.id, 0);
      return;
    }
    
    const amount = parseInt(cleanValue);
    const remainingBudget = getRemainingBudget() + userInvestment;
    
    if (amount <= remainingBudget) {
      setInvestmentAmount(amount);
      updateInvestment(currentPitch.id, amount);
    } else {
      const maxAmount = remainingBudget;
      setInvestmentAmount(maxAmount);
      updateInvestment(currentPitch.id, maxAmount);
    }
  };

  const nextPitch = () => {
    if (currentPitchIndex < sessionPitches.length - 1) {
      setCurrentPitchIndex(currentPitchIndex + 1);
    }
  };

  const prevPitch = () => {
    if (currentPitchIndex > 0) {
      setCurrentPitchIndex(currentPitchIndex - 1);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={prevPitch}
          disabled={currentPitchIndex === 0}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">{currentPitch.title}</h2>
          <p className="text-gray-600">by {currentPitch.presenter}</p>
          <p className="text-sm text-gray-500 mt-1">
            Pitch {currentPitchIndex + 1} of {sessionPitches.length}
          </p>
        </div>
        
        <button
          onClick={nextPitch}
          disabled={currentPitchIndex === sessionPitches.length - 1}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-gray-700 mb-8 text-center bg-gray-50 p-4 rounded-lg">
        {currentPitch.description}
      </p>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center text-gray-700 font-medium">
              <Star className="w-5 h-5 mr-2 text-yellow-500" />
              How cool is this?
            </label>
            <span className="text-2xl font-bold text-yellow-500">{coolness}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={coolness}
            onChange={(e) => handleCoolnessChange(e.target.value)}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Not cool</span>
            <span>Super cool!</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center text-gray-700 font-medium">
              <Target className="w-5 h-5 mr-2 text-blue-500" />
              How relevant is this to us or our clients?
            </label>
            <span className="text-2xl font-bold text-blue-500">{relevance}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={relevance}
            onChange={(e) => handleRelevanceChange(e.target.value)}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Not relevant</span>
            <span>Highly relevant!</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center text-gray-700 font-medium">
              <DollarSign className="w-5 h-5 mr-2 text-green-500" />
              Investment Amount
            </label>
            <span className="text-2xl font-bold text-green-500">
              ${Number(investmentAmount).toLocaleString()}
            </span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min="0"
            max={getRemainingBudget() + userInvestment}
            step="100"
            value={investmentAmount === '' ? '' : investmentAmount}
            onChange={(e) => handleInvestmentChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0"
          />
          <p className="text-sm text-gray-600 mt-2">
            Remaining budget: <span className="font-bold text-green-600">
              ${getRemainingBudget().toLocaleString()}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

// Investment Dashboard Component
const InvestmentDashboard = () => {
  const { investments, updateInvestment, currentUser, getRemainingBudget, TOTAL_BUDGET, sessionPitches } = useApp();
  const userInvestments = investments[currentUser.id] || {};

  const handleInvestmentUpdate = (pitchId, newAmount) => {
    const cleanValue = newAmount.replace(/[^\d]/g, '');
    
    if (cleanValue === '') {
      updateInvestment(pitchId, 0);
      return;
    }
    
    const amount = parseInt(cleanValue);
    const currentInvestments = investments[currentUser.id] || {};
    const totalOtherInvestments = Object.entries(currentInvestments)
      .filter(([id]) => id !== pitchId.toString())
      .reduce((sum, [, amt]) => sum + amt, 0);
    
    const maxAllowed = TOTAL_BUDGET - totalOtherInvestments;
    
    if (amount <= maxAllowed) {
      updateInvestment(pitchId, amount);
    } else {
      updateInvestment(pitchId, maxAllowed);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <TrendingUp className="w-6 h-6 mr-2 text-purple-500" />
        Your Investment Portfolio
      </h3>
      
      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-700">Total Budget:</span>
          <span className="text-xl font-bold">${TOTAL_BUDGET.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-700">Invested:</span>
          <span className="text-xl font-bold text-purple-600">
            ${(TOTAL_BUDGET - getRemainingBudget()).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-700">Remaining:</span>
          <span className="text-xl font-bold text-green-600">
            ${getRemainingBudget().toLocaleString()}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {sessionPitches.map(pitch => (
          <div key={pitch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800">{pitch.title}</h4>
              <p className="text-sm text-gray-600">{pitch.presenter}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">$</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                max={getRemainingBudget() + (userInvestments[pitch.id] || 0)}
                step="100"
                value={userInvestments[pitch.id] || ''}
                onChange={(e) => handleInvestmentUpdate(pitch.id, e.target.value)}
                className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const { ratings, investments, allParticipants, TOTAL_BUDGET, sessionPitches } = useApp();
  const [selectedPitch, setSelectedPitch] = useState(sessionPitches[0]?.id || 1);
  const [viewMode, setViewMode] = useState('byPitch');

  const getPitchDetails = (pitchId) => {
    const pitchRatings = [];

    allParticipants.forEach(user => {
      const userRating = ratings[user.id]?.[pitchId];
      const userInvestment = investments[user.id]?.[pitchId] || 0;

      pitchRatings.push({
        userId: user.id,
        userName: user.name,
        coolness: userRating?.coolness || 0,
        relevance: userRating?.relevance || 0,
        investment: userInvestment
      });
    });

    return pitchRatings;
  };

  const getUserDetails = (userId) => {
    const user = allParticipants.find(u => u.id === userId);
    if (!user) return null;

    const userRatings = ratings[userId] || {};
    const userInvestments = investments[userId] || {};
    const totalInvested = Object.values(userInvestments).reduce((sum, amt) => sum + amt, 0);

    const pitchDetails = sessionPitches.map(pitch => ({
      pitchId: pitch.id,
      pitchTitle: pitch.title,
      coolness: userRatings[pitch.id]?.coolness || 0,
      relevance: userRatings[pitch.id]?.relevance || 0,
      investment: userInvestments[pitch.id] || 0
    }));

    return {
      userName: user.name,
      totalInvested,
      remainingBudget: TOTAL_BUDGET - totalInvested,
      pitchDetails
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <Users className="w-5 h-5 mr-2 text-indigo-500" />
        Admin View - Detailed Breakdown
      </h3>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setViewMode('byPitch')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            viewMode === 'byPitch' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          View by Pitch
        </button>
        <button
          onClick={() => setViewMode('byUser')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            viewMode === 'byUser' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          View by User
        </button>
      </div>

      {viewMode === 'byPitch' ? (
        <div>
          <select
            value={selectedPitch}
            onChange={(e) => setSelectedPitch(parseInt(e.target.value))}
            className="w-full p-2 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sessionPitches.map(pitch => (
              <option key={pitch.id} value={pitch.id}>
                {pitch.title} - {pitch.presenter}
              </option>
            ))}
          </select>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Participant</th>
                  <th className="text-center p-2">Coolness</th>
                  <th className="text-center p-2">Relevance</th>
                  <th className="text-right p-2 whitespace-nowrap">Investment</th>
                </tr>
              </thead>
              <tbody>
                {getPitchDetails(selectedPitch).map((detail, index) => (
                  <tr key={detail.userId} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-2">{detail.userName}</td>
                    <td className="text-center p-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        {detail.coolness || '-'}
                      </span>
                    </td>
                    <td className="text-center p-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {detail.relevance || '-'}
                      </span>
                    </td>
                    <td className="text-right p-2 whitespace-nowrap">
                      <span className="font-semibold text-green-600">
                        ${detail.investment.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {allParticipants.map(user => {
              const details = getUserDetails(user.id);
              if (!details) return null;

              return (
                <div key={user.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-800">{details.userName}</h4>
                    <div className="text-right text-sm">
                      <div>Invested: <span className="font-semibold text-purple-600">${details.totalInvested.toLocaleString()}</span></div>
                      <div>Remaining: <span className="font-semibold text-green-600">${details.remainingBudget.toLocaleString()}</span></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {details.pitchDetails.map(pitch => (
                      <div key={pitch.pitchId} className="flex items-center justify-between text-sm">
                        <span className="flex-1">{pitch.pitchTitle}</span>
                        <div className="flex gap-2">
                          <span className="w-20 text-right font-semibold text-green-600">
                            ${pitch.investment.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Results Component
const Results = () => {
  const { getAggregatedResults, allParticipants } = useApp();
  const results = getAggregatedResults();

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Award className="w-6 h-6 mr-2 text-yellow-500" />
        Live Results
      </h3>
      
      <div className="mb-4 text-sm text-gray-600 flex items-center">
        <Users className="w-4 h-4 mr-1" />
        {allParticipants.length} participants voting
      </div>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={result.id}
            className={`p-4 rounded-lg ${
              index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center">
                  {index === 0 && <Award className="w-5 h-5 mr-2 text-yellow-600" />}
                  <h4 className="font-bold text-gray-800">
                    #{index + 1} {result.title}
                  </h4>
                </div>
                <p className="text-sm text-gray-600">{result.presenter}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">
                  {result.overallScore.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600">Overall Score</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-3 text-center">
              <div className="bg-white p-2 rounded">
                <div className="text-lg font-semibold text-yellow-600">
                  {result.avgCoolness.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600">Coolness</div>
              </div>
              <div className="bg-white p-2 rounded">
                <div className="text-lg font-semibold text-blue-600">
                  {result.avgRelevance.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600">Relevance</div>
              </div>
              <div className="bg-white p-2 rounded">
                <div className="text-lg font-semibold text-green-600">
                  ${result.totalInvestment.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  {result.investorCount} investors
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Session Header Component
const SessionHeader = () => {
  const { sessionId, currentUser, allParticipants } = useApp();
  const [copied, setCopied] = useState(false);

  const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sessionUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 text-center mb-4">Shark Tank Voting Session</h1>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">Session URL:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[200px] sm:max-w-none">{sessionUrl}</code>
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-gray-100 rounded transition flex-shrink-0"
              title="Copy session URL"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>
            {copied && <span className="text-xs text-green-600">Copied!</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {allParticipants.length} participants
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Welcome,</p>
            <p className="font-semibold text-gray-800">{currentUser.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Page Component
const AdminPage = () => {
  const { sessionId, allParticipants } = useApp();
  const [copied, setCopied] = useState(false);

  const sessionUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
  const adminUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}&admin=true`;

  const copySessionUrl = () => {
    navigator.clipboard.writeText(sessionUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
              <div className="text-sm text-gray-600 flex items-center mt-2">
                <Users className="w-4 h-4 mr-1" />
                {allParticipants.length} participants
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Session URL:</span>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[200px]">{sessionUrl}</code>
                <button
                  onClick={copySessionUrl}
                  className="p-1 hover:bg-gray-100 rounded transition"
                  title="Copy session URL"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
                {copied && <span className="text-xs text-green-600">Copied!</span>}
              </div>
              <button
                onClick={() => window.location.href = sessionUrl}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Exit Admin View
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Results />
          </div>
          <div>
            <AdminDashboard />
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">Admin URL</p>
          <p className="text-xs text-blue-700 mt-1">
            Bookmark this URL to return to admin view: <code className="bg-blue-100 px-1 rounded">{adminUrl}</code>
          </p>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const { currentUser, sessionId, isLoading, sessionExists } = useApp();
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminView = urlParams.get('admin') === 'true';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    );
  }

  if (!sessionId) {
    return <CreateSession />;
  }

  if (!sessionExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Session Not Found</h1>
          <p className="text-gray-600 mb-6">This session doesn't exist or has expired.</p>
          <button
            onClick={() => window.location.href = window.location.pathname}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create New Session
          </button>
        </div>
      </div>
    );
  }

  // Show admin page if admin=true in URL
  if (isAdminView) {
    return <AdminPage />;
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        <SessionHeader />
        
        <div className="grid grid-cols-1 gap-6">
          <PitchVoting />
          <InvestmentDashboard />
        </div>
      </div>
    </div>
  );
};

// Root Component with Provider
export default function SharkTankApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  
  return (
    <AppProvider sessionId={sessionId}>
      <App />
    </AppProvider>
  );
}
