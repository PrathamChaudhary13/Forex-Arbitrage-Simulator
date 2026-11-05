# Forex Arbitrage Simulator

A simulator that models currencies as a graph and detects **arbitrage opportunities** in foreign exchange rates using shortest-path algorithms. Built as an innovative assignment for **Design and Analysis of Algorithms (DAA)** at Nirma University.

## What is Forex Arbitrage?

Forex arbitrage is a sequence of currency conversions that ends in the starting currency with more money than you began with. For example:

```
USD -> EUR -> GBP -> USD
```

If the product of the exchange rates along this cycle is greater than 1, there is a risk-free profit.

## How It Works

1. **Graph model:** each currency is a vertex, and each exchange rate is a directed weighted edge.
2. **Weight transformation:** for a rate `r`, the edge weight is `-log(r)`.
   A cycle with `r1 * r2 * ... * rn > 1` becomes a cycle with total weight `< 0`.
3. **Detection:** a **negative-weight cycle** in the transformed graph means an arbitrage opportunity exists.
4. **Algorithm:** [Bellman-Ford / Floyd-Warshall] is used to detect the negative cycle and trace back the sequence of currencies.

### Complexity

| Algorithm      | Time       | Space  |
|----------------|------------|--------|
| Bellman-Ford   | O(V * E)   | O(V)   |
| Floyd-Warshall | O(V^3)     | O(V^2) |

*(Keep the row for the algorithm you used.)*

## Features

- Input exchange rates between multiple currencies
- Detects whether an arbitrage opportunity exists
- Prints the exact currency cycle that produces the profit
- Calculates the profit from a given starting amount
- [Add or remove features to match your project]

## Tech Stack

- Language: [Python / C++ / Java]
- [Libraries or frameworks, if any]

## Getting Started

### Prerequisites

- [Python 3.x / g++ / JDK] installed

### Installation

```bash
git clone https://github.com/PrathamChaudhary13/Forex-Arbitrage-Simulator.git
cd Forex-Arbitrage-Simulator
```

### Run

```bash
# Replace with your actual entry file
python main.py
```

## Example

```
Input rates:
USD -> EUR : 0.90
EUR -> GBP : 0.88
GBP -> USD : 1.30

Arbitrage found: USD -> EUR -> GBP -> USD
Start: 1000 USD
End:   1029.60 USD
Profit: 2.96%
```

*(Replace with real output from your program.)*

## Project Structure

```
Forex-Arbitrage-Simulator/
├── main.py        # Entry point
├── README.md
└── ...            # Update to match your files
```

## Author

**Pratham Chaudhary**
B.Tech Computer Science Engineering, Nirma University
GitHub: [@PrathamChaudhary13](https://github.com/PrathamChaudhary13)

## License

This project was created for academic purposes.
