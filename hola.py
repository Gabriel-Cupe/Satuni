def criba_eratostenes(n):
    criba = [True] * (n + 1)
    criba[0:2] = [False, False]  # 0 y 1 no son primos
    for num in range(2, int(n**0.5) + 1):
        if criba[num]:
            for multiplo in range(num**2, n + 1, num):
                criba[multiplo] = False
    return [num for num, is_primo in enumerate(criba) if is_primo]

# Ejemplo de uso
n = 100**3
primos = criba_eratostenes(n)

for primo in primos:
    with open("primos.txt", "a") as f:
        f.write(str(primo) + "\n")
print(primos)