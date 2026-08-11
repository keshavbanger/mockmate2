package com.example.mockmate.service;

import com.example.mockmate.model.techinterview.DSAProblem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class HarnessGeneratorService {

    public String generateHarness(String candidateCode, String lang, DSAProblem problem, String input, String jobId) {
        String cleanLang = lang != null ? lang.toLowerCase() : "java";
        return switch (cleanLang) {
            case "java" -> wrapJava(candidateCode, problem, input, jobId);
            case "python", "python3" -> wrapPython(candidateCode, problem, input);
            case "javascript", "js" -> wrapJs(candidateCode, problem, input);
            case "cpp", "c++" -> wrapCpp(candidateCode, problem, input);
            case "go" -> wrapGo(candidateCode, problem, input);
            default -> candidateCode;
        };
    }

    public String sourceFileName(String lang, String jobId) {
        String cleanLang = lang != null ? lang.toLowerCase() : "java";
        return switch (cleanLang) {
            case "java" -> "Main_" + jobId + ".java";
            case "python", "python3" -> "main_" + jobId + ".py";
            case "cpp", "c++" -> "main_" + jobId + ".cpp";
            case "javascript", "js" -> "main_" + jobId + ".js";
            case "go" -> "main_" + jobId + ".go";
            default -> "main_" + jobId;
        };
    }

    // ── JAVA HARNESS ──────────────────────────────────────────
    private String wrapJava(String code, DSAProblem problem, String input, String jobId) {
        String cleanCode = code != null ? code.trim() : "";

        // Candidates often paste code with their own explicit imports — a
        // habit from solving on LeetCode, where each submission is a
        // standalone file. This template already appends cleanCode verbatim
        // AFTER `public class Main_<jobId>` further down, so any import line
        // left inside it becomes an import statement placed after a type
        // declaration — a guaranteed compile error ("class, interface, enum,
        // or record expected") regardless of what's actually being imported.
        // Hoist any of the candidate's own import lines up to the top instead.
        StringBuilder extraImports = new StringBuilder();
        StringBuilder bodyLines = new StringBuilder();
        for (String line : cleanCode.split("\n", -1)) {
            if (line.trim().startsWith("import ")) {
                extraImports.append(line.trim()).append("\n");
            } else {
                bodyLines.append(line).append("\n");
            }
        }
        cleanCode = bodyLines.toString().trim();

        if (!cleanCode.contains("class ")) {
            cleanCode = "class Solution {\n" + cleanCode + "\n}";
        }

        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        return """
import java.util.*;
import java.util.stream.*;
import java.lang.reflect.*;
%s
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
    public static ListNode fromArray(int[] nums) {
        if (nums == null || nums.length == 0) return null;
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (int n : nums) {
            curr.next = new ListNode(n);
            curr = curr.next;
        }
        return dummy.next;
    }
    public static String toListString(ListNode head) {
        List<Integer> list = new ArrayList<>();
        while (head != null) {
            list.add(head.val);
            head = head.next;
        }
        return list.toString().replace(" ", "");
    }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
    public static TreeNode fromLevelOrder(String s) {
        if (s == null || s.isEmpty() || s.equals("[]") || s.equals("null")) return null;
        String clean = s.replaceAll("[\\\\[\\\\]\\\\s]", "");
        if (clean.isEmpty()) return null;
        String[] parts = clean.split(",");
        if (parts.length == 0 || parts[0].equals("null") || Part0Empty(parts)) return null;
        TreeNode root = new TreeNode(Integer.parseInt(parts[0]));
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < parts.length) {
            TreeNode curr = q.poll();
            if (i < parts.length && !parts[i].equals("null") && !parts[i].isEmpty()) {
                curr.left = new TreeNode(Integer.parseInt(parts[i]));
                q.add(curr.left);
            }
            i++;
            if (i < parts.length && !parts[i].equals("null") && !parts[i].isEmpty()) {
                curr.right = new TreeNode(Integer.parseInt(parts[i]));
                q.add(curr.right);
            }
            i++;
        }
        return root;
    }
    private static boolean Part0Empty(String[] p) { return p[0].isEmpty(); }
    public static String toLevelOrderString(TreeNode root) {
        if (root == null) return "[]";
        List<String> res = new ArrayList<>();
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        while (!q.isEmpty()) {
            TreeNode curr = q.poll();
            if (curr != null) {
                res.add(String.valueOf(curr.val));
                q.add(curr.left);
                q.add(curr.right);
            } else {
                res.add("null");
            }
        }
        while (!res.isEmpty() && res.get(res.size() - 1).equals("null")) {
            res.remove(res.size() - 1);
        }
        return "[" + String.join(",", res) + "]";
    }
}

public class Main_%s {
    public static void main(String[] args) throws Exception {
        Solution sol = new Solution();
        Method targetMethod = null;
        for (Method m : Solution.class.getDeclaredMethods()) {
            if (Modifier.isPublic(m.getModifiers()) && !m.getName().startsWith("lambda$")) {
                targetMethod = m;
                break;
            }
        }
        if (targetMethod == null) {
            System.out.println("No solution method found");
            return;
        }

        String rawInput = "%s";
        String[] lines = rawInput.split("\\\\n");
        Class<?>[] paramTypes = targetMethod.getParameterTypes();
        Object[] invokeArgs = new Object[paramTypes.length];

        for (int i = 0; i < paramTypes.length; i++) {
            String line = i < lines.length ? lines[i].trim() : "";
            Class<?> pType = paramTypes[i];
            if (pType == int[].class) {
                if (line.isEmpty() || line.equals("[]")) {
                    invokeArgs[i] = new int[0];
                } else {
                    String clean = line.replaceAll("[\\\\[\\\\]\\\\s]", "");
                    invokeArgs[i] = clean.isEmpty() ? new int[0] : Arrays.stream(clean.split(",")).mapToInt(Integer::parseInt).toArray();
                }
            } else if (pType == int[][].class) {
                invokeArgs[i] = parseMatrix(line);
            } else if (pType == int.class || pType == Integer.class) {
                invokeArgs[i] = line.isEmpty() ? 0 : Integer.parseInt(line.trim());
            } else if (pType == String.class) {
                invokeArgs[i] = line.replaceAll("^\\\"|\\\"$", "");
            } else if (pType == boolean.class || pType == Boolean.class) {
                invokeArgs[i] = Boolean.parseBoolean(line.trim());
            } else if (pType == ListNode.class) {
                int[] arr = line.isEmpty() || line.equals("[]") ? new int[0] : Arrays.stream(line.replaceAll("[\\\\[\\\\]\\\\s]", "").split(",")).mapToInt(Integer::parseInt).toArray();
                invokeArgs[i] = ListNode.fromArray(arr);
            } else if (pType == TreeNode.class) {
                invokeArgs[i] = TreeNode.fromLevelOrder(line);
            } else {
                invokeArgs[i] = null;
            }
        }

        Object result = targetMethod.invoke(sol, invokeArgs);
        printResult(result);
    }

    private static int[][] parseMatrix(String line) {
        if (line == null || line.isEmpty() || line.equals("[]")) return new int[0][0];
        String clean = line.trim();
        if (clean.startsWith("[") && clean.endsWith("]")) clean = clean.substring(1, clean.length() - 1).trim();
        if (clean.isEmpty()) return new int[0][0];
        String[] rows = clean.split("\\\\],\\\\s*\\\\[");
        List<int[]> matrix = new ArrayList<>();
        for (String row : rows) {
            String rClean = row.replaceAll("[\\\\[\\\\]\\\\s]", "");
            if (rClean.isEmpty()) {
                matrix.add(new int[0]);
            } else {
                matrix.add(Arrays.stream(rClean.split(",")).mapToInt(Integer::parseInt).toArray());
            }
        }
        return matrix.toArray(new int[0][]);
    }

    private static void printResult(Object res) {
        if (res == null) {
            System.out.println("null");
        } else if (res instanceof ListNode) {
            System.out.println(ListNode.toListString((ListNode) res));
        } else if (res instanceof TreeNode) {
            System.out.println(TreeNode.toLevelOrderString((TreeNode) res));
        } else if (res instanceof int[]) {
            System.out.println(Arrays.toString((int[]) res).replace(" ", ""));
        } else if (res instanceof int[][]) {
            int[][] m = (int[][]) res;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < m.length; i++) {
                sb.append(Arrays.toString(m[i]).replace(" ", ""));
                if (i < m.length - 1) sb.append(",");
            }
            sb.append("]");
            System.out.println(sb.toString());
        } else if (res instanceof Object[]) {
            System.out.println(Arrays.toString((Object[]) res).replace(" ", ""));
        } else if (res instanceof List<?>) {
            System.out.println(res.toString().replace(" ", ""));
        } else {
            System.out.println(res.toString());
        }
    }
}

%s
""".formatted(extraImports.toString(), jobId, escapedInput, cleanCode);
    }

    // ── PYTHON HARNESS ────────────────────────────────────────
    private String wrapPython(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("class Solution")) {
            StringBuilder indented = new StringBuilder();
            for (String line : cleanCode.split("\n", -1)) {
                indented.append("    ").append(line).append("\n");
            }
            cleanCode = "class Solution:\n" + indented;
        }
        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        return """
import json, ast

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def _array_to_listnode(arr):
    if not arr:
        return None
    head = ListNode(arr[0])
    curr = head
    for v in arr[1:]:
        curr.next = ListNode(v)
        curr = curr.next
    return head

def _listnode_to_string(node):
    res = []
    while node:
        res.append(node.val)
        node = node.next
    return "[" + ",".join(str(x) for x in res) + "]"

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

%s

def _parse_arg(s):
    s = s.strip()
    if s == "":
        return None
    try:
        return json.loads(s)
    except Exception:
        pass
    try:
        return ast.literal_eval(s)
    except Exception:
        pass
    return s

def _fmt(r):
    if r is None:
        return "null"
    if isinstance(r, bool):
        return "true" if r else "false"
    if isinstance(r, ListNode):
        return _listnode_to_string(r)
    if isinstance(r, (list, tuple)):
        return "[" + ",".join(_fmt(x) for x in r) + "]"
    return str(r)

sol = Solution()
_target = None
for _name, _val in vars(Solution).items():
    if callable(_val) and not _name.startswith("_"):
        _target = _name
        break

if _target is None:
    print("No solution method found")
else:
    _raw = "%s"
    _lines = _raw.split("\\n")
    _args = [_parse_arg(l) for l in _lines if l.strip() != ""]
    _result = getattr(sol, _target)(*_args)
    print(_fmt(_result))
""".formatted(cleanCode, escapedInput);
    }

    // ── JAVASCRIPT HARNESS ─────────────────────────────────────
    private String wrapJs(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("class Solution")) {
            cleanCode = "class Solution {\n" + cleanCode + "\n}";
        }
        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        return """
function ListNode(val, next) {
    this.val = (val===undefined ? 0 : val);
    this.next = (next===undefined ? null : next);
}

function _arrayToListNode(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const dummy = new ListNode(0);
    let curr = dummy;
    for (const v of arr) {
        curr.next = new ListNode(v);
        curr = curr.next;
    }
    return dummy.next;
}

function _listNodeToString(head) {
    const res = [];
    while (head) {
        res.push(head.val);
        head = head.next;
    }
    return "[" + res.join(",") + "]";
}

%s

function _parseArg(s) {
    s = s.trim();
    if (s === "") return undefined;
    try { return JSON.parse(s); } catch (e) {}
    return s;
}

function _fmt(r) {
    if (r === null || r === undefined) return "null";
    if (typeof r === "boolean") return r ? "true" : "false";
    if (r instanceof ListNode || (r && typeof r === "object" && "val" in r && "next" in r)) return _listNodeToString(r);
    if (Array.isArray(r)) return "[" + r.map(_fmt).join(",") + "]";
    return String(r);
}

const sol = new Solution();
const _proto = Object.getOwnPropertyNames(Object.getPrototypeOf(sol));
const _target = _proto.find(n => n !== "constructor" && typeof sol[n] === "function");

if (!_target) {
    console.log("No solution method found");
} else {
    const _raw = "%s";
    const _args = _raw.split("\\n").filter(l => l.trim() !== "").map(_parseArg);
    const _result = sol[_target](..._args);
    console.log(_fmt(_result));
}
""".formatted(cleanCode, escapedInput);
    }

    // ── C++ HARNESS ───────────────────────────────────────────
    private String wrapCpp(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("class Solution")) {
            cleanCode = "class Solution {\npublic:\n" + cleanCode + "\n};";
        }
        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        // Infer function name from signature or code
        String funcName = (problem != null && problem.getSignature() != null && problem.getSignature().getFunctionName() != null)
                ? problem.getSignature().getFunctionName()
                : extractCppFuncName(cleanCode);

        return """
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <cctype>

using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

static vector<int> parseVectorInt(const string& s) {
    vector<int> res;
    if (s.empty() || s == "[]") return res;
    string clean = s;
    clean.erase(remove(clean.begin(), clean.end(), '['), clean.end());
    clean.erase(remove(clean.begin(), clean.end(), ']'), clean.end());
    clean.erase(remove(clean.begin(), clean.end(), ' '), clean.end());
    if (clean.empty()) return res;
    stringstream ss(clean);
    string token;
    while (getline(ss, token, ',')) {
        if (!token.empty()) {
            res.push_back(stoi(token));
        }
    }
    return res;
}

static void printVectorInt(const vector<int>& v) {
    cout << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        cout << v[i] << (i + 1 < v.size() ? "," : "");
    }
    cout << "]" << endl;
}

%s

int main() {
    string rawInput = "%s";
    stringstream ss(rawInput);
    string line1, line2;
    getline(ss, line1);
    getline(ss, line2);

    Solution sol;
    // Basic dispatcher for typical array/int inputs
    if (!line1.empty() && line1[0] == '[') {
        vector<int> nums = parseVectorInt(line1);
        if (!line2.empty() && isdigit(line2[0])) {
            int target = stoi(line2);
            vector<int> res = sol.%s(nums, target);
            printVectorInt(res);
            return 0;
        } else {
            // single vector or int return
            auto res = sol.%s(nums);
            printVectorInt(res);
            return 0;
        }
    } else if (!line1.empty()) {
        int n = stoi(line1);
        auto res = sol.%s(n);
        cout << res << endl;
        return 0;
    }
    cout << "[]" << endl;
    return 0;
}
""".formatted(cleanCode, escapedInput, funcName, funcName, funcName);
    }

    private String extractCppFuncName(String code) {
        // Fallback default
        if (code.contains("twoSum")) return "twoSum";
        if (code.contains("maxSubArray")) return "maxSubArray";
        if (code.contains("climbStairs")) return "climbStairs";
        if (code.contains("reverseList")) return "reverseList";
        if (code.contains("isPalindrome")) return "isPalindrome";
        return "solve";
    }

    // ── GO HARNESS ────────────────────────────────────────────
    private String wrapGo(String code, DSAProblem problem, String input) {
        String cleanCode = code != null ? code.trim() : "";
        if (!cleanCode.contains("package main")) {
            cleanCode = "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n\t\"strings\"\n)\n\n" + cleanCode;
        }
        String escapedInput = input != null ? input.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") : "";

        String funcName = (problem != null && problem.getSignature() != null && problem.getSignature().getFunctionName() != null)
                ? capitalize(problem.getSignature().getFunctionName())
                : "TwoSum";

        return """
%s

func parseGoIntSlice(s string) []int {
    s = strings.Trim(s, " []\\n\\r")
    if s == "" {
        return []int{}
    }
    parts := strings.Split(s, ",")
    res := make([]int, 0, len(parts))
    for _, p := range parts {
        p = strings.TrimSpace(p)
        if v, err := strconv.Atoi(p); err == nil {
            res = append(res, v)
        }
    }
    return res
}

func main() {
    rawInput := "%s"
    lines := strings.Split(rawInput, "\\n")
    line1 := ""
    line2 := ""
    if len(lines) > 0 { line1 = strings.TrimSpace(lines[0]) }
    if len(lines) > 1 { line2 = strings.TrimSpace(lines[1]) }

    sol := Solution{}
    if strings.HasPrefix(line1, "[") {
        nums := parseGoIntSlice(line1)
        if line2 != "" {
            target, _ := strconv.Atoi(line2)
            res := sol.%s(nums, target)
            fmt.Printf("%%v\\n", res)
            return
        }
    }
    fmt.Println("[]")
}
""".formatted(cleanCode, escapedInput, funcName);
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return Character.toUpperCase(str.charAt(0)) + str.substring(1);
    }
}
