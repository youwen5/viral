{-# LANGUAGE NamedFieldPuns #-}

module Main where

-- | We will implement a simple 4th-order Runge-Kutta (RK4) solver
--   for the SEIR model equations.

-- Data type to hold the state of the SEIR compartments.
data SEIR = SEIR
  { s :: Double  -- Susceptible
  , e :: Double  -- Exposed
  , i :: Double  -- Infectious
  , r :: Double  -- Recovered
  } deriving (Show)

-- Data type to hold SEIR parameters.
data Params = Params
  { beta   :: Double  -- Infection rate
  , sigma  :: Double  -- Rate from exposed to infectious
  , gamma  :: Double  -- Recovery rate
  , totalN :: Double  -- Total population (S+E+I+R assumed ~ constant)
  } deriving (Show)

-- | The SEIR system of ODEs:
--   dS/dt = -beta * S * I / N
--   dE/dt =  beta * S * I / N - sigma * E
--   dI/dt =  sigma * E - gamma * I
--   dR/dt =  gamma * I
--
--   This function takes time t (unused here for an autonomous system),
--   the current state (SEIR), and parameters, and returns the derivatives.
seirDerivs :: Params -> Double -> SEIR -> SEIR
seirDerivs Params{beta, sigma, gamma, totalN} _ SEIR{s, e, i, r} =
  let dS = -beta * s * i / totalN
      dE =  beta * s * i / totalN - sigma * e
      dI =  sigma * e - gamma * i
      dR =  gamma * i
  in SEIR dS dE dI dR

-- | Runge-Kutta 4th order step
--   Given:
--     f   : ODE function
--     h   : step size
--     t   : current time
--     y   : current state
--   returns the new state y_{n+1}
rk4Step
  :: (Params -> Double -> SEIR -> SEIR)  -- ODE function
  -> Params                             -- model parameters
  -> Double                             -- step size
  -> Double                             -- current time
  -> SEIR                               -- current state
  -> SEIR                               -- state at next time step
rk4Step f params h t y =
  let k1 = f params t                y
      k2 = f params (t + 0.5*h) (addSEIR y (scaleSEIR (0.5*h) k1))
      k3 = f params (t + 0.5*h) (addSEIR y (scaleSEIR (0.5*h) k2))
      k4 = f params (t + h)       (addSEIR y (scaleSEIR h       k3))

      dy = scaleSEIR (1/6) $
             addSEIR k1 $
             addSEIR (scaleSEIR 2 k2) $
             addSEIR (scaleSEIR 2 k3) k4
  in addSEIR y (scaleSEIR h dy)

-- | Helper to add two SEIR states.
addSEIR :: SEIR -> SEIR -> SEIR
addSEIR (SEIR s1 e1 i1 r1) (SEIR s2 e2 i2 r2) =
  SEIR (s1 + s2) (e1 + e2) (i1 + i2) (r1 + r2)

-- | Helper to scale an SEIR state by a scalar.
scaleSEIR :: Double -> SEIR -> SEIR
scaleSEIR c (SEIR s e i r) = SEIR (c*s) (c*e) (c*i) (c*r)

-- | Simulate over multiple steps using RK4.
simulateRK4
  :: (Params -> Double -> SEIR -> SEIR)  -- ODE function
  -> Params                              -- model params
  -> Double                              -- step size (h)
  -> Double                              -- start time (t0)
  -> Double                              -- end time (tEnd)
  -> SEIR                                -- initial state
  -> [(Double, SEIR)]                   -- list of (time, state)
simulateRK4 f params h t0 tEnd y0
  | t0 > tEnd = []
  | otherwise =
      let y1 = rk4Step f params h t0 y0
      in (t0, y0) : simulateRK4 f params h (t0 + h) tEnd y1

-- | Main driver: set parameters, initial conditions, and run.
main :: IO ()
main = do
  -- Example parameter values for H5N1 (these are placeholders; adjust as appropriate)
  let params = Params
        { beta   = 1.5    -- infection rate
        , sigma  = 0.2    -- ~ 5 days incubation
        , gamma  = 0.25   -- ~ 4 days infectious period
        , totalN = 1e6    -- total population
        }

  -- Initial conditions: some fraction exposed; no infectious; rest susceptible
  let s0 = 1e6 - 100  -- 1,000,000 total, 100 initially exposed
      e0 = 100
      i0 = 0
      r0 = 0
      y0 = SEIR s0 e0 i0 r0

  -- Simulation settings
  let tStart = 0.0
      tEnd   = 100.0  -- run for 100 days
      dt     = 1.0    -- step size in days

  putStrLn "Running SEIR simulation for H5N1..."
  putStrLn "time, S, E, I, R"

  -- Run the simulation
  let results = simulateRK4 seirDerivs params dt tStart tEnd y0

  -- Print the results to stdout
  mapM_ (\(t, SEIR{s, e, i, r}) ->
           putStrLn $ show t ++ ","
                      ++ show s ++ ","
                      ++ show e ++ ","
                      ++ show i ++ ","
                      ++ show r)
        results
