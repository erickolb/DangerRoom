package net.chateaulore.dangerroom

import org.junit.Assert.*
import org.junit.Test

class InputTest {
    @Test fun originsSupportSelfHosting() {
        assertEquals("https://comics.example.net", Input.origin(" comics.example.net "))
        assertEquals("https://comics.example.net:8443", Input.origin("https://comics.example.net:8443/"))
        for (value in listOf("http://example.net", "https://a:b@example.net", "https://example.net/path", "https://example.net?q=x", "https://example.net#x")) {
            assertTrue(value, runCatching { Input.origin(value) }.isFailure)
        }
    }
    @Test fun bridgePathsStayInsideTheConfiguredApi() {
        assertTrue(Input.apiPath("/api/search?q=Batman"))
        for (path in listOf("https://other.example/api/x", "//other.example/api/x", "/covers/x", "/api/../session", "/api/\\other", "/api/search#fragment")) assertFalse(path, Input.apiPath(path))
    }
}
