# AI Exam Proctor 🛡️ — Zero-Setup Web Portal

An AI-powered online examination, biometric proctoring, and viva defense platform that runs **100% in the browser using free client-side technologies**. No Docker, no Python virtual environments, no database servers, and no paid API keys required. Everything is embedded into a single, self-contained application that works by just clicking a link!

---

## ⚡ Quick Start: Open with 1 Click

### Option A: Local 1-Click Launcher (Recommended)
Simply double-click **`start_server.bat`** in the project folder.  
It automatically starts a local server and opens a **fresh, isolated browser window** directly to:
👉 **`http://localhost:5000`** *(or `http://localhost:5050` if 5000 is occupied)*

*(Alternatively, you can also double-click **`open_direct.bat`** or directly double-click **`index.html`** in any web browser!)*

---

## 🔒 Smart Audio Proctoring & Features in v3.3

### 1. Intelligent Speech Keyword Monitoring (Zero Strikes on Background Noise!)
* **Ambient Sound Allowed**: Real-world ambient noise (fans, breathing, family talking in the background, chair creaks, street sounds) is **100% ignored** and will **NEVER** trigger violations or lock the exam window.
* **Targeted Exam Keyword Detection**: The browser's speech recognition engine continuously monitors spoken English for forbidden exam & coding keywords:
  * Algorithm & Code Terms: `"two sum"`, `"hash map"`, `"dictionary"`, `"time complexity"`, `"space complexity"`, `"big o"`, `"import sys"`, `"test case"`, `"def two_sum"`, `"return indices"`
  * Cheating Phrases: `"what is the answer"`, `"tell me the answer"`, `"how to solve"`, `"write the code"`, `"chatgpt"`, `"google the answer"`
* **Fair Warning**: When exam code keywords are spoken aloud, the system shows a warning toast and logs a soft notice. It requires 3 repeated keyword warnings before turning into a strike.
* **Non-Intrusive Strikes**: Soft warnings update the strike counter badge dynamically without refreshing or disturbing your cursor in the code editor.

### 2. Strict Role Separation & Security Guardrails
* **No Cross-Role Leaks**: Students have **zero access** to the Teacher Dashboard.
* **Dedicated Route Guards**: Any unauthorized access attempt redirects students back to their secure student portal.

### 3. Teacher-Controlled Student Biometric Enrollment
* Instructors register students with **Name**, **Email**, **Password**, and an **Official Biometric Profile Photo** captured live with the teacher's webcam (or file upload).
* Students log in with those credentials, and Identity Verification matches their live face against that teacher-enrolled photo.

### 4. Rigorous AI Viva Voce Evaluation
* **Honest Scoring (0 / 10 pts for Wrong Answers)**: Entering an incorrect answer, evasive text (e.g. *"idk"*), or algorithmic misconceptions receives **0 / 10 points** and a **"Low Confidence"** badge with honest AI feedback.
* **100-Point Grading Weighting**:
  * **Coding Sandbox (Pyodide WASM)**: 40 points
  * **Written Rubric Analysis**: 30 points
  * **Oral AI Viva Defense**: 30 points (10 pts $\times$ 3 questions)
* Includes 1-click **"Test Correct Answer"** and **"Test Wrong Answer"** buttons for immediate verification.
